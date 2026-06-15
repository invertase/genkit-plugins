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
is delivered out-of-band through `onSpec`/`onPartial`. The per-request streaming
channel reaches the tool via Genkit's **action context**: the flow passes it with
`ai.generateStream({ context: { chat } })` and the callbacks read it back —
concurrency-safe, no `AsyncLocalStorage` needed.

> [!NOTE]
> Chat history is replayed as plain text turns — the model's tool calls and the
> rendered specs are not included. Follow-ups like "make that chart a line chart"
> work only as well as the model's own prose recap of what it rendered. A real
> app would persist richer history (e.g. the tool summaries) per turn.

The rendered cards are [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn)
components (shadcn/ui + Tailwind v4) — `Card`, `Table`, `Badge`, `Alert`, etc.

## Forms: actions + `$state`

Two interaction styles, side by side:

- **Choices** — behavior baked into a component. The model supplies data
  (`options`); clicking is hardcoded in the React impl (`useRespond`). No actions.
- **Forms** — behavior wired by the model through json-render's action system.
  The catalog declares a `submit` action; the model renders inputs two-way bound
  to state (`"value": { "$bindState": "/form/email" }`) plus a Button with
  `"on": { "press": { "action": "submit", "params": { "values": { "$state": "/form" } } } }`.
  Typing updates client-side state only; on press, `ActionProvider` resolves
  `params.values` against the live state and calls the `submit` handler
  (`src/registry.tsx`), which sends the values back as the user's next message.

Try: _"Plan a team offsite — collect the details in a form."_

## Where to look

The plugin integration is the top level; `src/ui/` is just app chrome and
component implementations:

```
server/index.ts    defineRenderTool + chat flow (the server-side integration)
src/catalog.ts     the shared catalog: components + the `submit` action contract
src/registry.tsx   catalog → React components + the `submit` action handler
src/App.tsx        streamFlow loop + rendering the streamed specs
src/respond.tsx    Choices round-trip (rendered UI → next user message)
src/ui/            chrome (header, composer) + Chart/Choices/Icon implementations
```

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
