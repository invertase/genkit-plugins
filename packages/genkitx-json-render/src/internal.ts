import { type Catalog, createSpecStreamCompiler, type Spec } from '@json-render/core';
import { type GenerateOptions, type Genkit, type ModelArgument, z } from 'genkit';

/** What to do when the final spec fails catalog validation. */
export type ValidationMode = 'off' | 'warn' | 'throw';

/** A single problem found while validating the generated spec. */
export interface SpecIssue {
  /** Element key the issue belongs to, or null for graph-level issues. */
  elementKey: string | null;
  message: string;
}

/** Framing layered onto the catalog's generated system prompt. */
export interface PromptInstructions {
  /** Custom intro prepended to the catalog prompt (json-render `system`). */
  system?: string;
  /** Extra rules appended to the catalog prompt (json-render `customRules`). */
  rules?: string[];
}

/**
 * Default system-prompt intro layered onto the catalog's generated prompt when
 * no `instructions.system` is provided. Exported so you can reference or extend
 * it (e.g. `instructions: { system: `${DEFAULT_SYSTEM_PROMPT} Use a dark theme.` }`).
 */
export const DEFAULT_SYSTEM_PROMPT =
  'You are a UI generator. Build a clear, well-structured interface from the ' +
  "catalog below that best fulfils the user's request. Use only the listed " +
  'components, keep copy concise and specific, and favour a sensible visual hierarchy.';

/** Build the system prompt from the catalog plus optional framing. */
export function buildSystem(catalog: Catalog, instructions?: PromptInstructions): string {
  return catalog.prompt({
    mode: 'standalone',
    system: instructions?.system ?? DEFAULT_SYSTEM_PROMPT,
    customRules: instructions?.rules,
  });
}

/**
 * Resolve the input schema and prompt builder, defaulting to a single string
 * field (`field`) used verbatim as the user message.
 */
export function resolveInput<I extends z.ZodTypeAny>(
  options: { inputSchema?: I; buildPrompt?: (input: z.infer<I>) => string },
  field: string,
): { inputSchema: I; buildPrompt: (input: z.infer<I>) => string } {
  const inputSchema = (options.inputSchema ?? z.object({ [field]: z.string() })) as I;
  const buildPrompt =
    options.buildPrompt ??
    ((input: z.infer<I>) => String((input as Record<string, unknown>)[field] ?? ''));
  return { inputSchema, buildPrompt };
}

/**
 * Make a partial spec safe to render: prune child refs to elements that haven't
 * streamed in yet. Returns `null` while the spec has no resolvable root — i.e.
 * nothing renderable yet. Does not mutate the input.
 */
export function sanitizePartialSpec(spec: Spec): Spec | null {
  const els = spec.elements ?? {};
  if (!spec.root || !(spec.root in els)) return null;
  const elements: Spec['elements'] = {};
  for (const [key, el] of Object.entries(els)) {
    elements[key] = el.children
      ? { ...el, children: el.children.filter((child) => child in els) }
      : el;
  }
  return { ...spec, elements };
}

/**
 * Stream the model's JSONL patch output through json-render's compiler, building
 * a `Spec`. `onPartial` fires with a render-safe partial (see
 * {@link sanitizePartialSpec}) each time a patch lands — the flow wires it to
 * `sendChunk`; the tool wires it to its own `onPartial` option.
 */
export async function streamSpec(
  ai: Genkit,
  params: {
    model: ModelArgument;
    system: string;
    prompt: string;
    config?: GenerateOptions['config'];
    abortSignal?: AbortSignal;
    onPartial?: (spec: Spec) => void;
  },
): Promise<Spec> {
  const compiler = createSpecStreamCompiler<Spec>();
  const { stream, response } = ai.generateStream({
    model: params.model,
    system: params.system,
    prompt: params.prompt,
    ...(params.config ? { config: params.config } : {}),
    ...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (!text) continue;
    const { result, newPatches } = compiler.push(text);
    if (newPatches.length > 0 && params.onPartial) {
      const safe = sanitizePartialSpec(result);
      if (safe) params.onPartial(safe);
    }
  }

  // Surface any generation error and apply trailing text not seen as a chunk.
  const final = await response;
  if (final.text) compiler.push(final.text);

  return compiler.getResult();
}

/** Validate a spec against the catalog and warn/throw per `mode`. */
export function applyValidation(
  catalog: Catalog,
  spec: Spec,
  mode: ValidationMode,
  label: string,
  onIssues?: (issues: SpecIssue[], spec: Spec) => void,
): void {
  if (mode === 'off') return;
  const result = catalog.validate(spec);
  if (result.success) return;

  const issues = toIssues(result.error);
  if (onIssues) {
    onIssues(issues, spec);
  } else if (mode === 'warn') {
    console.warn(
      `json-render: "${label}" spec has ${issues.length} validation issue(s):\n${formatIssues(issues)}`,
    );
  }
  if (mode === 'throw') {
    throw new Error(`json-render: spec failed catalog validation:\n${formatIssues(issues)}`);
  }
}

/** Map a Zod validation error from `catalog.validate` into flat {@link SpecIssue}s. */
function toIssues(
  error: { issues?: Array<{ path?: PropertyKey[]; message: string }> } | undefined,
): SpecIssue[] {
  if (!error?.issues) return [];
  return error.issues.map((issue) => {
    const path = issue.path ?? [];
    const elementKey = path[0] === 'elements' && path[1] != null ? String(path[1]) : null;
    const suffix = path.slice(elementKey ? 2 : 0).join('.');
    return { elementKey, message: suffix ? `${suffix}: ${issue.message}` : issue.message };
  });
}

function formatIssues(issues: SpecIssue[]): string {
  return issues
    .map((i) => `  - ${i.elementKey ? `[${i.elementKey}] ` : ''}${i.message}`)
    .join('\n');
}
