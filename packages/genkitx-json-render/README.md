# genkitx-json-render

A [Genkit](https://genkit.dev) plugin for **generative UI** with
[json-render](https://json-render.dev). Stream a json-render UI spec from a model
inside a Genkit flow, and render it on the client with the **same catalog**.

> [!WARNING]
> **Experimental.** This plugin is early and unstable, provided as-is with no
> guarantees or support. APIs may change or break without notice. Use at your own risk.

```
defineRenderFlow(ai, { catalog, model, … })
        │
        ├─ catalog.prompt()      → system prompt (json-render JSONL patch protocol)
        ├─ generateStream(...)   → model streams JSONL patches as text
        ├─ SpecStreamCompiler    → patches compiled into a Spec, streamed via sendChunk
        └─ catalog.validate()    → final spec checked against the catalog
```

The plugin is a thin bridge: **json-render owns the catalog, prompt, spec shape,
and validation**; Genkit owns the model, streaming, flow, and request context. The
catalog you pass here is the one you also render with on the client, so server and
UI can't drift — and there's no intermediate spec format to convert.

## Install

```bash
pnpm add genkitx-json-render @json-render/core genkit
# client side, to render the spec:
pnpm add @json-render/react
```

## Quick start

### 1. Define the catalog (shared by server + client)

```ts
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const catalog = defineCatalog(schema, {
  components: {
    Container: {
      props: z.object({}),
      slots: ['default'],
      description: 'Page wrapper that stacks its children vertically.',
    },
    Hero: {
      props: z.object({ headline: z.string(), subhead: z.string(), ctaLabel: z.string() }),
      description: 'Top-of-page hero.',
    },
    Feature: {
      props: z.object({
        icon: z.enum(['zap', 'shield', 'rocket', 'sparkles']),
        title: z.string(),
        body: z.string(),
      }),
      description: 'One feature card.',
    },
  },
});
```

> To keep the server React-free, define the structural schema with
> `@json-render/core`'s `defineSchema` instead of importing one from
> `@json-render/react/schema`.

### 2. Define the flow (server)

```ts
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { defineRenderFlow } from 'genkitx-json-render';
import { catalog } from './catalog';

const ai = genkit({ plugins: [googleAI()] });

export const pitchFlow = defineRenderFlow(ai, {
  name: 'json-render',
  catalog,
  model: googleAI.model('gemini-2.5-flash'),
  inputSchema: z.object({ pitch: z.string().min(4).max(400) }),
  buildPrompt: ({ pitch }) => `Generate a landing page for this pitch: ${pitch}`,
  instructions: {
    system: 'You generate landing-page specs for startup pitches.',
    rules: ['Hero first, then 3-5 Features, then a closing CTA.'],
  },
  validate: 'warn', // 'off' | 'warn' | 'throw' — 'warn' logs catalog issues
  before: async ({ pitch }, { context }) => {
    // quota checks, kill switches, auth — throw to abort.
    // context is typed: context?.rawRequest?.ip
  },
});
```

For the common single-string case, omit `inputSchema` and `buildPrompt` — the flow
takes `{ prompt: string }` and uses it as the user message:

```ts
export const pageFlow = defineRenderFlow(ai, {
  name: 'page',
  catalog,
  model: googleAI.model('gemini-2.5-flash'),
});
// call with { prompt: 'A dog-walking SaaS for busy tech workers' }
```

### 3. Render the stream (client)

The same `catalog` builds the registry. Each streamed `Spec` chunk goes straight
to `<Renderer>` — no conversion:

```tsx
import { defineRegistry, Renderer } from '@json-render/react';
import { catalog } from './catalog';

export const { registry } = defineRegistry(catalog, {
  components: {
    Container: ({ children }) => <div className="stack">{children}</div>,
    Hero: ({ props }) => <Hero {...props} />,
    Feature: ({ props }) => <Feature {...props} />,
  },
  actions: {},
});

// for await (const chunk of stream) setSpec(chunk)  ->  <Renderer spec={spec} registry={registry} />
```

## API

### `defineRenderFlow(ai, options)`

Returns a Genkit flow (`streamSchema`/`outputSchema` are the json-render `Spec`).
Streamed chunks are **render-safe**: nothing is emitted until the root element
exists, and child refs to not-yet-streamed elements are pruned — so each chunk
can go straight to `<Renderer>`. The flow's `abortSignal` is forwarded to
`generateStream`, so cancelling the request cancels generation.

| Option | Type | |
| --- | --- | --- |
| `name` | `string` | Flow name. |
| `catalog` | `Catalog` | A json-render catalog (from `defineCatalog`). |
| `model` | `ModelArgument` | e.g. `googleAI.model('gemini-2.5-flash')`. |
| `inputSchema?` | `ZodType` | Defaults to `z.object({ prompt: z.string() })`. |
| `buildPrompt?` | `(input) => string` | Defaults to `(input) => input.prompt`. |
| `instructions?` | `{ system?, rules? }` | Layered onto `catalog.prompt()`. `system` defaults to the exported `DEFAULT_SYSTEM_PROMPT`. |
| `config?` | `object` | Passed to `generateStream`. |
| `validate?` | `'off' \| 'warn' \| 'throw'` | Default `'warn'`. |
| `onIssues?` | `(issues, spec) => void` | Overrides the default `'warn'` log. |
| `before?` | `(input, ctx) => void \| Promise` | Runs before generation; throw to abort. |

### `defineRenderTool(ai, options)`

Returns a Genkit tool the model calls mid-conversation to render UI. The model
gets back a compact summary (`{ rendered, elementCount, root }`); the spec itself
is delivered out-of-band:

| Option | Type | |
| --- | --- | --- |
| `name`, `description` | `string` | Tool identity; `description` drives the model's tool-use decision. |
| `catalog`, `model`, `inputSchema?`, `buildPrompt?`, `instructions?`, `config?`, `validate?`, `onIssues?` | | Same as the flow (default input is `{ intent: string }`). |
| `onSpec?` | `(spec, input, { context }) => void \| Promise` | Final spec, out-of-band. Throw to abort. |
| `onPartial?` | `(spec, input, { context }) => void` | Render-safe partial per applied patch — wire to live updates. |

`context` is Genkit's action context: pass request-scoped values (e.g. a
streaming channel) via `ai.generate({ context: { ... } })` and read them back in
the callbacks — no `AsyncLocalStorage` needed. See the
[`agentic-chat` example](../../examples/agentic-chat).

### `sanitizePartialSpec(spec)`

The pruning used for streamed partials, exported for hosts that forward specs
through their own channel: drops child refs to missing elements and returns
`null` while the spec has no resolvable root.

## How it works

json-render's native `Spec` keeps `elements` as a **keyed map**, which strict JSON
Schema can't constrain — so json-render generates via a **JSONL patch stream**
described by `catalog.prompt()`, not monolithic structured output. This plugin
leans into that: the model streams patches, `createSpecStreamCompiler` assembles
them into a `Spec` (emitting a partial on every applied patch), and
`catalog.validate()` checks the result. Genkit never sees a json-render (zod v4)
schema — it only does text streaming — so this composes cleanly with Genkit's own
zod v3 stack.

## License

Apache-2.0
