import type { Catalog, Spec } from '@json-render/core';
import { type Genkit, type ModelArgument, z } from 'genkit';
import {
  applyValidation,
  buildSystem,
  type PromptInstructions,
  resolveInput,
  type SpecIssue,
  streamSpec,
  type ValidationMode,
} from './internal.js';

/** Default input schema used when `inputSchema` is omitted: `{ intent: string }`. */
type DefaultIntentSchema = z.ZodObject<{ intent: z.ZodString }>;

/** The compact summary the model receives back after the tool renders UI. */
const ToolResultSchema = z.object({
  rendered: z.boolean(),
  elementCount: z.number(),
  root: z.string(),
});

/** Options for {@link defineRenderTool}. */
export interface RenderToolOptions<I extends z.ZodTypeAny = DefaultIntentSchema> {
  /** Tool name the model calls, e.g. `'renderUI'`. */
  name: string;
  /** When the model should call it — drives the model's tool-use decision. */
  description: string;
  /** A json-render `Catalog`. The same catalog drives the client `Renderer`. */
  catalog: Catalog;
  /** Model used to generate the spec inside the tool. */
  model: ModelArgument;
  /** Schema for the tool input. Defaults to `z.object({ intent: z.string() })`. */
  inputSchema?: I;
  /**
   * Build the generation prompt from the tool input. Defaults to
   * `(input) => input.intent`.
   */
  buildPrompt?: (input: z.infer<I>) => string;
  /** Intro/rules layered onto the catalog's generated system prompt. */
  instructions?: PromptInstructions;
  /** Model generation config passed straight through to `generateStream`. */
  config?: Record<string, unknown>;
  /** Validate the generated spec against the catalog. Default `'warn'`. */
  validate?: ValidationMode;
  /** Called with any validation issues (in `'warn'` and `'throw'` modes). */
  onIssues?: (issues: SpecIssue[], spec: Spec) => void;
  /**
   * Receives the generated spec out-of-band — the host wires this to deliver the
   * spec to the client (the model only gets the compact summary). Throw to abort.
   */
  onSpec?: (spec: Spec, input: z.infer<I>) => void | Promise<void>;
  /**
   * Receives each partial spec as the model streams patches — wire this to push
   * live, element-by-element updates to the client. Fires before {@link onSpec}.
   */
  onPartial?: (spec: Spec, input: z.infer<I>) => void;
}

/**
 * Define a Genkit tool the model can call mid-conversation to render UI.
 *
 * Use this for **agentic / chat** generative UI: the host calls
 * `ai.generate({ tools: [renderTool] })`, the model decides to call the tool with
 * an intent, and the tool generates a json-render `Spec` from the catalog.
 *
 * The model only receives a compact summary (`{ rendered, elementCount, root }`)
 * so the spec doesn't bloat the conversation; the spec itself is delivered to your
 * host via {@link RenderToolOptions.onSpec}, which forwards it to the client where
 * the same catalog renders it.
 *
 * For a direct "input in, page out" endpoint, see {@link defineRenderFlow}.
 */
export function defineRenderTool<I extends z.ZodTypeAny = DefaultIntentSchema>(
  ai: Genkit,
  options: RenderToolOptions<I>,
) {
  const mode: ValidationMode = options.validate ?? 'warn';
  const system = buildSystem(options.catalog, options.instructions);
  const { inputSchema, buildPrompt } = resolveInput(options, 'intent');

  return ai.defineTool(
    {
      name: options.name,
      description: options.description,
      inputSchema,
      outputSchema: ToolResultSchema,
    },
    async (input: z.infer<I>) => {
      const onPartial = options.onPartial;
      const spec = await streamSpec(ai, {
        model: options.model,
        system,
        prompt: buildPrompt(input),
        config: options.config,
        onPartial: onPartial ? (partial) => onPartial(partial, input) : undefined,
      });

      applyValidation(options.catalog, spec, mode, options.name, options.onIssues);
      await options.onSpec?.(spec, input);

      return {
        rendered: true,
        elementCount: Object.keys(spec.elements ?? {}).length,
        root: spec.root ?? '',
      };
    },
  );
}
