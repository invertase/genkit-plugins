# Example: landing-page

An end-to-end demo of [`genkitx-json-render`](../../packages/genkitx-json-render): a
Genkit flow streams a json-render UI spec from Gemini, and a Vite + React client
renders it live with the **same catalog**.

> [!WARNING]
> **Experimental.** Example code, provided as-is with no guarantees. Use at your own risk.

```
src/catalog.ts ──┬──► server/index.ts   defineRenderFlow → startFlowServer (:3400)
                 └──► src/registry.tsx   defineRegistry → <Renderer> (Vite :5173)
```

`src/catalog.ts` is the single source of truth — imported by the server (drives the
prompt + validation) and the client (drives the render registry). The components
come from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn)
(shadcn/ui + Tailwind v4), so the model builds pages from a real component library.

## Run

Uses **Google AI** (Gemini) with an API key.

```bash
cp .env.example .env   # add your GOOGLE_GENAI_API_KEY
pnpm install           # from the repo root
pnpm --filter @genkitx-json-render/example-landing-page dev
```

The `.env` is loaded automatically. Get a key at https://aistudio.google.com/apikey.

Then open http://localhost:5173, type a pitch, and watch the page stream in.

`pnpm dev` runs two processes:

- **server** (`tsx watch server/index.ts`) — the Genkit flow server on `:3400`
- **web** (`vite`) — the React client on `:5173`, proxying `/api/*` → `:3400`

## How the stream flows

1. Client calls the flow via `streamFlow({ url: '/api/landingPage', input })`
   (`genkit/beta/client`).
2. The flow (`defineRenderFlow`) feeds `catalog.prompt()` to Gemini, which emits
   json-render JSONL patches.
3. The plugin compiles patches into a `Spec` and streams each partial back.
4. Each chunk is a `Spec` → `setSpec(chunk)` → `<Renderer>` paints it immediately.
