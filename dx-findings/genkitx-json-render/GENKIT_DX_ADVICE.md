# Genkit DX audit: generative UI gaps found in production-style integration work

Audience: Genkit maintainers and product owners. This is a sharp DX audit from building `genkitx-json-render` (schema-validated generative UI specs streamed from Genkit) plus two working apps: `landing-page` and `agentic-chat`. The goal is not to argue that Genkit cannot do this. It can. The goal is to show where product builders currently have to invent framework code that Genkit should own.

## Contents

1. [Executive readout](#executive-readout)
2. [Tool calls cannot emit client-visible data parts](#p0-tool-calls-cannot-emit-client-visible-data-parts)
3. [No product-grade React client layer](#p1-no-product-grade-react-client-layer)
4. [No HTTP session primitive preserves tool history](#p1-no-http-session-primitive-preserves-tool-history)
5. [Cancellation exists, but discoverability failed the test](#p2-cancellation-exists-but-discoverability-failed-the-test)
6. [ActionContext is untyped](#p2-actioncontext-is-untyped)
7. [Custom output formats can't carry config](#p3-custom-output-formats-cant-carry-config)
8. [The zod v3/v4 split](#p3-the-zod-v3v4-split)
9. [Flow middleware is fragmented](#p3-flow-middleware-is-fragmented)
10. [What worked well](#what-worked-well)
11. [Recommended Google actions](#recommended-google-actions)

## Executive readout

Genkit is a good substrate for generative UI: flows stream cleanly, model choice is composable, action context reaches tools, and `startFlowServer` makes a prototype feel real quickly. The gaps below are therefore product gaps, not dead ends. They are the places where a serious app has to rebuild client runtime, session transport, artifact streaming, and request plumbing around Genkit.

The competitive comparison is direct: AI SDK-style data parts and client hooks make product UI feel first-class. Genkit's model/tool/flow primitives are strong, but the HTTP + React + multi-turn path still asks every team to rediscover the same patterns. This repo is concrete evidence: the plugin and examples work, but several files exist mainly to bridge missing platform affordances.

> Recommendation: prioritize client-visible tool data parts, a React client layer, and HTTP sessions with full tool history. Those three remove the largest amount of custom host code and make Genkit credible for agentic product UI without requiring every app to adopt the full Agents runtime up front.

## P0: Tool calls cannot emit client-visible data parts

**Impact:** this is the blocking gap for agentic product UI. A tool often produces a large artifact, such as a UI spec, chart, form, report, preview, or map, that belongs in the client, not in the model transcript. Genkit has no sanctioned channel for that artifact today. Tool functions receive `ActionFnArg<never>`; `sendChunk` is typed `never`, so tools structurally cannot stream client-visible data.

**Evidence from this repo:** the chat example ships a three-layer side channel:

- Plugin invents `onSpec`/`onPartial` callbacks to smuggle the artifact out of the tool.
- The host flow invents a `ChatChunk` discriminated union to multiplex text deltas and specs over `sendChunk`.
- The per-request streaming channel reaches the tool by stuffing a function into `ai.generateStream({ context })`, which works because context propagates to tools, but is undocumented as a pattern. We initially shipped an `AsyncLocalStorage` workaround before discovering it.

Today, the host flow has to do this:

```ts
const chatChannel = { send: sendChunk, specs: [] };
const { stream } = ai.generateStream({
  tools: [renderUI],
  // smuggle a *function* through action context
  context: { ...context, chat: chatChannel },
});
// tool callback digs it back out:
onSpec: (spec, _i, { context }) =>
  (context?.chat as ChatChannel)?.send(...);
```

The desired shape is closer to:

```ts
ai.defineTool({ ... },
  async (input, { sendChunk }) => {
    // typed tool streaming, surfaced as
    // tagged chunks in generateStream's
    // stream alongside text/tool events
    sendChunk({ type: 'ui', spec });
    return summary;
  });
```

> Ask: typed tool streaming, or custom data parts, surfaced in `generateStream`'s chunk stream so a flow can forward them. This is the Vercel AI SDK's "data parts", its single biggest DX edge for UI work. It would delete the plugin's callback plumbing, the chunk union, and the context smuggling.

**Upstream status, checked 2026-06-12:** being actively designed, Go-first, under the Agents umbrella. [#4797](https://github.com/firebase/genkit/pull/4797) (open, exp) adds `tool.SendPartial`: partial tool responses surfaced as `ModelResponseChunk`s with `Part.IsPartial()`. The session-flow design ([RFC #4467](https://github.com/firebase/genkit/issues/4467)) adds a `Responder` with `SendArtifact` / `SendStatus`; artifacts are named part collections persisted to the session and forwarded to the client, which is precisely the spec-out-of-band shape. JS side: [#5424](https://github.com/firebase/genkit/pull/5424) (closed prototype, Jun 2026) wires an `AgentEvent` union with `artifact-emitted` and `status` variants end-to-end. So the concept is validated, but it is arriving via Agents/sessions, not plain `generateStream`. The product risk is forcing teams that only need tool artifacts to adopt the full agent runtime. The tool-level primitive should exist independently.

## P1: No product-grade React client layer

**Impact:** `genkit/beta/client`'s `streamFlow` is a bare async iterator. That is a solid transport primitive, but it is not the product UI abstraction developers compare against AI SDK. Every Genkit + React app now has to write the same state machine around streaming, cancellation, optimistic turns, retries, and stable callbacks.

**Evidence from this repo:** the chat example needed around 100 lines of client runtime code:

- Accumulate deltas, flush snapshots into state per chunk.
- A ref mirror of conversation state so the send callback stays referentially stable. It feeds a context provider; naive deps re-render every consumer per token.
- A synchronous in-flight ref, because a state-based `busy` guard has a double-submit race until the next render.
- An abort controller plus an "alive" ref so unmount cancels the request and stops stale state writes.

> Ask: ship `@genkit-ai/react` with `useFlow` / `useChat`-style hooks that own these patterns. For product builders, this is not sugar; it is the first surface they touch and the first comparison they make.

**Upstream status, checked 2026-06-12:** in flight on two fronts. [RFC #4803 "Genkit Client"](https://github.com/firebase/genkit/pull/4803) (Ehesp, draft Feb 2026) proposes exactly this list: client factory with shared config, end-to-end type inference from server flow schemas, retry/backoff, React hooks, Vue composables, and a client-side chat primitive. Its motivation section matches our findings nearly point-for-point. And [#5424](https://github.com/firebase/genkit/pull/5424) prototyped a framework-agnostic `AgentSession` core with thin React and Angular adapters (11 React sample pages validated). Direction is right; add this chat example's concrete bug list (stable-callback ref mirror, double-submit race, unmount teardown) to the RFC as evidence.

## P1: No HTTP session primitive preserves tool history

**Impact:** multi-turn product UI needs durable chat state, resumable streams, and complete model history, including tool calls and tool results. `ai.chat()` + session stores exist (beta, server-side), but `startFlowServer` exposes none of it. That leaves HTTP apps with a manually reconstructed transcript, which is exactly where agentic UI loses memory.

**Evidence from this repo:** the chat example hand-rolls a `history` array in the input schema, client-side history reconstruction, and role/content mapping into `messages`. The immediate consequence: tool calls and tool results are dropped from replayed history, so the model forgets what it rendered. "Make that chart a line chart" only works as well as the model's own prose recap.

> Ask: expose sessions through the flow server: session id in/out, pluggable store, full `ai.Message` history. Or, at minimum, publish a multi-turn HTTP recipe that preserves tool request/response pairs.

**Upstream status, checked 2026-06-12:** this is the most active area of the repo. [RFC #4467 "Session flows"](https://github.com/firebase/genkit/issues/4467): stateful multi-turn flows with snapshot persistence, pluggable `SessionStore`, client-managed or server-managed state, and resumable timelines, built on bidirectional streaming ([Go RFC #4184](https://github.com/firebase/genkit/pull/4184), [JS RFC #4210](https://github.com/firebase/genkit/pull/4210), JS implementation [#4288](https://github.com/firebase/genkit/pull/4288) open and updated 2026-06-11). Go is ahead: session flows already renamed/unified as "agents" ([#5234](https://github.com/firebase/genkit/pull/5234), merged), background detach shipped ([#5193](https://github.com/firebase/genkit/pull/5193)). Notably, `SessionState.Messages` is full `ai.Message` history, tool request/response pairs included, which fixes exactly the "model forgets what it rendered" problem. This repo's hand-rolled history is the interim shape to migrate off.

## P2: Cancellation exists, but discoverability failed the test

**Impact:** cancellation is already available, but not discoverable enough to function as platform DX. The first version of this audit claimed `streamFlow` accepts no `AbortSignal`. Wrong: Genkit 1.36's client signature is `streamFlow({ url, input, streamId?, headers?, abortSignal? })`, and the server chain is complete: flows receive `abortSignal`, `GenerateOptions` takes it, and the plugin forwards it.

**Evidence from this repo:** the integration was built while reading typings and still shipped a bail-out-flag workaround first, because nothing in the docs or examples surfaced cancellation or `streamId` resumable streams. An API that exists but is not discoverable costs the same as one that does not exist for humans and coding agents alike.

> Ask: document the cancellation story end-to-end (client abort -> express handler -> flow signal -> model call), show it in React examples, and verify the express adapter actually cancels the flow on client disconnect. Recent merges suggest active hardening here: [#5435](https://github.com/firebase/genkit/pull/5435) (propagate reader cancellation to the source, Jun 3) and [#5481](https://github.com/firebase/genkit/pull/5481) (harden streaming in express/fetch handlers, Jun 10).

## P2: ActionContext is untyped

**Impact:** action context is the right place for request-scoped values, but TypeScript cannot help providers and consumers agree on what is present. `ActionContext = Record<string, any>`, which means the moment a project depends on context, it loses type safety at the Genkit boundary.

**Evidence from this repo:** the plugin hand-declares `context?.rawRequest?.ip` to give its `before` hook something usable; the chat example casts `context?.chat as ChatChannel`. Both are type assertions over contracts Genkit actually controls.

> Ask: a generic parameter or module-augmentation point for context (`Genkit<TContext>` or `declare module` merging), so context providers and consumers share one type.

**Upstream status, checked 2026-06-12:** no open issues or PRs found. Genuinely unclaimed; good candidate for a fresh issue or contribution. It is additive and non-breaking via an optional generic.

## P3: Custom output formats can't carry config

**Impact:** Genkit has a promising output-format abstraction, but it is not configurable enough for catalog-driven formats. json-render's spec keeps elements as a keyed map and streams as JSONL patches, so strict structured output does not fit. That is fine; this is exactly what `defineFormat` should be able to cover.

**Evidence from this repo:** a format handler only receives a JSON schema; there is no way to pass the catalog (which owns the prompt, patch protocol, and validator) per call. So the plugin bypasses the output system entirely and does raw text + its own compiler, losing `output.format` composability with `generate`, prompts, and evals.

> Ask: let formats accept arbitrary per-call config: `output: { format: 'json-render', config: { catalog } }`, handed to the format handler. Then "spec" becomes a first-class output type instead of a sidecar.

**Upstream status, checked 2026-06-12:** no activity on format config. Adjacent: [#5371](https://github.com/firebase/genkit/pull/5371) (merged May 2026) added `annotateSchema` for UI-specific metadata on schemas, signaling appetite for richer schema/output metadata, but not this. Unclaimed.

## P3: The zod v3/v4 split

**Impact:** Genkit re-exports zod v3 while much of the surrounding TypeScript ecosystem, json-render included, is on zod v4. This turns schema sharing into a compatibility problem for plugin authors.

**Evidence from this repo:** the plugin survives only because it never hands Genkit a json-render schema; the boundary is plain text. Any plugin that does need to share schemas across that line is stuck converting or pinning.

> Ask: zod v4 support, or schema-library-agnostic boundaries that accept Standard Schema.

**Upstream status, checked 2026-06-12:** tracked in [#3470](https://github.com/firebase/genkit/issues/3470). Maintainer (pavelgj, Feb 2026): zod v4 is planned for the Genkit 2.0 release as a breaking change, "no solid ETA yet, but we are starting to feel the need ourselves." Plan for the plugin's text-boundary workaround to remain necessary until 2.0.

## P3: Flow middleware is fragmented

**Impact:** auth, quota, kill switches, and request enrichment should be portable across adapters. Today they have three partial homes: express `contextProvider`s, Firebase `onCallGenkit` policies, and nothing portable at the flow level.

**Evidence from this repo:** the plugin grew its own `before` hook. It works, but every plugin inventing its own hook shape is the symptom.

> Ask: a flow-level middleware/interceptor API (request in -> context out, throw to reject) that the express and Firebase adapters both honor.

**Upstream status, checked 2026-06-12:** no direct work found. If anything the surface is growing: [#5477](https://github.com/firebase/genkit/pull/5477) (merged Jun 2026) added a fastify adapter, a third server adapter with its own context/auth wiring, which makes a portable middleware layer more valuable, not less. Unclaimed.

## What worked well

These are the primitives that made the integration worth building on Genkit:

- **Context propagation into tools.** `generate({ context })` reaching tool functions is what let us delete the `AsyncLocalStorage` hack. It just needs documentation as the blessed pattern for per-request tool deps.
- **Flow streaming ergonomics.** `defineFlow` + `streamSchema` + `sendChunk` made "stream partial specs" a ten-line job. `streamingRequested` is a nice touch.
- **`abortSignal` plumbing.** Already present from `streamFlow` through flows and `GenerateOptions`; it needs documentation and examples more than a new primitive.
- **`ModelArgument`.** Passing `googleAI.model('gemini-2.5-flash')` straight through the plugin without caring what it is.
- **`startFlowServer`.** Flow to HTTP endpoint in one call; both example servers are around 100 lines including all app logic.

## Recommended Google actions

- **Ship client-visible tool data parts outside the full Agents runtime.** Agents should support artifacts, but plain `generateStream` tools need the same primitive so apps can adopt it incrementally.
- **Publish the React client layer with the real failure modes covered.** Use this repo's stable-callback ref mirror, double-submit guard, abort-on-unmount, and streamed artifact state as acceptance tests for `useFlow` / `useChat`.
- **Expose HTTP sessions that preserve tool history.** The session store must retain full `ai.Message` history, not a flattened text transcript, or agentic UI will forget the artifacts it created.
- **Document action context propagation immediately.** It already works and deleted an `AsyncLocalStorage` workaround here; make it a blessed recipe for per-request tool dependencies.
- **File/design the unclaimed additive gaps.** Typed `ActionContext`, per-call format config, and portable flow middleware are smaller than Agents/client work but unlock cleaner plugin architecture.

## Priority table

| Priority | Gap | Ask | Upstream (2026-06-12) |
| --- | --- | --- | --- |
| P0 | No tool -> client streaming | Typed tool data parts in `generateStream` | In design: Go `tool.SendPartial` (#4797), `SendArtifact`/`SendStatus` in Agents RFC; JS prototype #5424 |
| P1 | No React client layer | `@genkit-ai/react` hooks | RFC #4803 (client SDK + hooks, draft); #5424 React/Angular adapters prototyped |
| P1 | No HTTP sessions/tool history | Sessions via flow server with full `ai.Message` history | Most active area: RFCs #4467/#4468, JS bidi impl #4288 in flight, Go shipped experimentally |
| P2 | Cancellation discoverability | Document it; verify express end-to-end | Exists in 1.36 (`abortSignal`, `streamId`); teardown hardening #5435, #5481 just merged |
| P2 | Untyped context | Typed/augmentable `ActionContext` | No activity; unclaimed, file it |
| P3 | Formats can't take config | Per-call format config | No activity; unclaimed, file it |
| P3 | zod v3 only | zod v4 / Standard Schema | #3470: planned for Genkit 2.0, no ETA |
| P3 | Middleware fragmentation | Portable flow middleware | No activity; new fastify adapter (#5477) widens the surface |

## Migration implications for genkitx-json-render

- **Native tool data parts would delete the tool side channel.** `defineRenderTool`'s `onSpec`/`onPartial` callbacks, host `ChatChunk` union, and context-smuggled streaming channel could collapse into one Genkit artifact/data-part stream.
- **React hooks would shrink the examples substantially.** The hand-rolled stream loop, stable callback mirrors, in-flight guard, and unmount cancellation in `agentic-chat` are framework code, not app logic.
- **HTTP sessions would make rendered UI editable across turns.** Preserving tool request/response pairs fixes the current "model forgets what it rendered" limitation and gives artifacts a real conversational identity.
- **Format config would most change the plugin architecture.** The JSONL compiler could become a first-class Genkit output format parameterized by the json-render catalog, instead of a raw-text sidecar around `generate`.
- **Watch:** JS bidi implementation [#4288](https://github.com/firebase/genkit/pull/4288) (active as of yesterday). When it lands, `defineRenderTool`'s `onSpec`/`onPartial` should grow a native transport, and the Artifact concept maps 1:1 onto a rendered spec.

Prepared for Genkit maintainers from `packages/genkitx-json-render`, `examples/landing-page`, and `examples/agentic-chat` in this repo. Genkit 1.36.0, @json-render 0.19.0. Upstream survey: github.com/firebase/genkit issues/PRs as of 2026-06-12.
