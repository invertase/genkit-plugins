import type { Catalog, Spec } from '@json-render/core';
import { type GenerateOptions, type Genkit, type ModelArgument, z } from 'genkit';
import {
  applyValidation,
  buildSystem,
  type PromptInstructions,
  resolveInput,
  type SpecIssue,
  streamSpec,
  type ValidationMode,
} from './internal.js';

/** Flow context passed to the {@link RenderFlowOptions.before} hook. */
interface RenderFlowContext {
  /** Genkit request context — e.g. `context.rawRequest?.ip` behind `onCallGenkit`. */
  context?: { rawRequest?: { ip?: string } } & Record<string, unknown>;
}

/** Default input schema used when `inputSchema` is omitted: `{ prompt: string }`. */
type DefaultInputSchema = z.ZodObject<{ prompt: z.ZodString }>;

/** Options for {@link defineRenderFlow}. */
export interface RenderFlowOptions<I extends z.ZodTypeAny = DefaultInputSchema> {
  /** Flow name. */
  name: string;
  /**
   * A json-render `Catalog` (from `@json-render/core`'s `defineCatalog`). The
   * same catalog drives the client `Renderer`, so server and UI never drift.
   */
  catalog: Catalog;
  /** Model to generate with, e.g. `googleAI.model('gemini-2.5-flash')`. */
  model: ModelArgument;
  /** Schema for the flow input. Defaults to `z.object({ prompt: z.string() })`. */
  inputSchema?: I;
  /**
   * Build the user prompt from the input. Defaults to `(input) => input.prompt`,
   * which pairs with the default input schema.
   */
  buildPrompt?: (input: z.infer<I>) => string;
  /** Intro/rules layered onto the catalog's generated system prompt. */
  instructions?: PromptInstructions;
  /** Model generation config passed straight through to `generateStream`. */
  config?: GenerateOptions['config'];
  /** Validate the final spec against the catalog. Default `'warn'`. */
  validate?: ValidationMode;
  /**
   * Called with any validation issues (in `'warn'` and `'throw'` modes). When
   * omitted, `'warn'` mode logs the issues with `console.warn`.
   */
  onIssues?: (issues: SpecIssue[], spec: Spec) => void;
  /**
   * Runs before generation — the place for quota checks, kill switches, auth, or
   * logging. Throw to abort the flow. Receives the input and the flow context.
   */
  before?: (input: z.infer<I>, ctx: RenderFlowContext) => void | Promise<void>;
}

/**
 * Define a Genkit flow that streams a json-render UI spec.
 *
 * The model emits json-render's JSONL patch stream (driven by `catalog.prompt()`);
 * the flow compiles those patches into a `Spec`, streaming each partial through
 * `sendChunk` for the client `Renderer`, and validates the final spec with
 * `catalog.validate()`. Streamed partials are render-safe: nothing is emitted
 * until the root element exists, and child refs to not-yet-streamed elements are
 * pruned. Prompt, spec shape, and validation all come from the catalog you also
 * render with — one source of truth.
 *
 * For the common single-string case, omit `inputSchema`/`buildPrompt`: the flow
 * takes `{ prompt: string }` and uses it as the user message.
 *
 * Use this for a direct endpoint ("pitch in, page out"). For UI rendered by a
 * model mid-conversation, see {@link defineRenderTool}.
 */
export function defineRenderFlow<I extends z.ZodTypeAny = DefaultInputSchema>(
  ai: Genkit,
  options: RenderFlowOptions<I>,
) {
  const mode: ValidationMode = options.validate ?? 'warn';
  const system = buildSystem(options.catalog, options.instructions);
  const { inputSchema, buildPrompt } = resolveInput(options, 'prompt');

  return ai.defineFlow(
    {
      name: options.name,
      inputSchema,
      streamSchema: z.custom<Spec>(),
      outputSchema: z.custom<Spec>(),
    },
    async (input, { context, sendChunk, abortSignal }) => {
      await options.before?.(input, { context });

      const spec = await streamSpec(ai, {
        model: options.model,
        system,
        prompt: buildPrompt(input),
        config: options.config,
        abortSignal,
        onPartial: (partial) => sendChunk(partial),
      });

      applyValidation(options.catalog, spec, mode, options.name, options.onIssues);
      return spec;
    },
  );
}
