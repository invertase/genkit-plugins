# Example: agentic-chat

**Agentic generative UI.** A chat where the model decides, mid-conversation, when
to render a UI card — via `defineRenderTool` from
[`genkitx-json-render`](../../packages/genkitx-json-render).

> [!WARNING]
> **Experimental.** Example code, provided as-is with no guarantees. Use at your own risk.

```
ai.generate({ tools: [renderUI] })
        │  model calls renderUI("Q3 revenue $1.2M, +18%")
        ▼
  defineRenderTool  ── generates a Spec from the catalog
        │  ├─ model gets back: { rendered, elementCount, root }   (compact summary)
        │  └─ onSpec(spec)  ── captured per-request, returned to the client
        ▼
  client renders the Spec with the same catalog
```

The model's context stays clean — it only sees a small summary. The actual `Spec`
is delivered out-of-band through `onSpec`, collected per-request with
`AsyncLocalStorage` (concurrency-safe), and returned alongside the reply text.

The rendered cards are [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn)
components (shadcn/ui + Tailwind v4) — `Card`, `Table`, `Badge`, `Alert`, etc.

## Run

Uses **Google AI** (Gemini) with an API key.

```bash
cp .env.example .env   # add your GOOGLE_GENAI_API_KEY
pnpm install           # from the repo root
pnpm --filter @genkitx-json-render/example-agentic-chat dev
```

The `.env` is loaded automatically. Get a key at https://aistudio.google.com/apikey.

Open http://localhost:5174 and try:

- "Show me Q3 revenue: $1.2M, up 18% from Q2"
- "Compare our Free, Pro and Team plans"
- "Summarize the launch checklist"

The model replies in text and calls `renderUI` when a card communicates better.

## How it differs from the `landing-page` example

| | `landing-page` (flow) | `agentic-chat` (tool) |
| --- | --- | --- |
| Primitive | `defineRenderFlow` | `defineRenderTool` |
| Trigger | direct call ("pitch in, page out") | model decides, mid-conversation |
| Streaming | partial spec streamed via `sendChunk` | spec delivered on tool completion via `onSpec` |
| Model sees | n/a | a compact summary, not the spec |
