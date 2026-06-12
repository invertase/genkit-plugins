# genkit-plugins

A pnpm + Turborepo monorepo of [Genkit](https://genkit.dev) plugins by
[Invertase](https://invertase.io).

> [!WARNING]
> **Experimental.** Everything here is early, unstable, and provided as-is with no
> guarantees or support. APIs may change or break without notice. Use at your own risk.

## Plugins

| Package | Description |
| --- | --- |
| [`genkitx-json-render`](./packages/genkitx-json-render) | Generative UI — stream structured, schema-validated UI specs from a model and render them with [json-render](https://www.npmjs.com/package/@json-render/core). |

## Examples

All examples use [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn)
(shadcn/ui + Tailwind v4) for the rendered components.

| Example | Shows |
| --- | --- |
| [`landing-page`](./examples/landing-page) | **Flow** — `defineRenderFlow` streams a UI spec from Gemini into a Vite + React client that renders it with the same catalog. |
| [`agentic-chat`](./examples/agentic-chat) | **Tool** — `defineRenderTool`: a chat where the model decides to render UI cards mid-conversation. |

## Development

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm build       # turbo run build
pnpm test        # turbo run test
pnpm typecheck   # turbo run typecheck
pnpm lint        # biome check
```

Each plugin lives in `packages/*` and is independently versioned and published.

## License

Apache-2.0
