import { AsyncLocalStorage } from 'node:async_hooks';
import { startFlowServer } from '@genkit-ai/express';
import { googleAI } from '@genkit-ai/google-genai';
import type { Spec } from '@json-render/core';
import { genkit, z } from 'genkit';
import { defineRenderTool } from 'genkitx-json-render';
import { catalog } from '../src/catalog';

// Reads GOOGLE_GENAI_API_KEY from the environment (see .env.example).
const ai = genkit({ plugins: [googleAI()] });

const model = googleAI.model('gemini-2.5-flash');

/** One streamed chunk: an assistant text delta, or a (possibly partial) UI spec. */
type ChatChunk = { type: 'text'; delta: string } | { type: 'spec'; id: string; spec: Spec };

/** Per-request streaming context, carried into the tool via AsyncLocalStorage. */
interface ChatContext {
  send: (chunk: ChatChunk) => void;
  specs: Spec[];
}

const ctxStore = new AsyncLocalStorage<ChatContext>();

const renderUI = defineRenderTool(ai, {
  name: 'renderUI',
  description:
    'Render a small UI card to show the user — stats, lists, callouts, summaries. ' +
    'Call this whenever a visual would communicate better than prose. The "intent" ' +
    'should fully describe the UI to build, including any concrete data.',
  catalog,
  model,
  instructions: {
    rules: [
      'Never use emoji. For visual cues, use the Icon component (lucide icons).',
      'Lead metrics with a Stat or Heading; keep cards focused and scannable.',
      'Put literal values directly in component props. Never use state bindings ($state).',
      'For trends, distributions, or comparisons across categories, use a Chart.',
      'When the user should pick between options, render a Choices component — the ' +
        'selection comes back to you as their next message, so you can continue.',
      'For Choices options, write literal string labels and values — never $state.',
    ],
  },
  validate: 'warn',
  // Stream partial specs to the client as the model emits patches — live render.
  onPartial: (spec) => {
    if (spec.root) ctxStore.getStore()?.send({ type: 'spec', id: spec.root, spec });
  },
  onSpec: (spec) => {
    const ctx = ctxStore.getStore();
    if (!ctx) return;
    if (spec.root) ctx.send({ type: 'spec', id: spec.root, spec });
    ctx.specs.push(spec);
  },
});

const messageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string(),
});

export const chat = ai.defineFlow(
  {
    name: 'chat',
    inputSchema: z.object({
      history: z.array(messageSchema).default([]),
      message: z.string().min(1),
    }),
    streamSchema: z.custom<ChatChunk>(),
    outputSchema: z.object({
      reply: z.string(),
      ui: z.array(z.custom<Spec>()),
    }),
  },
  async ({ history, message }, { sendChunk }) => {
    const ctx: ChatContext = { send: sendChunk, specs: [] };

    const reply = await ctxStore.run(ctx, async () => {
      const { stream, response } = ai.generateStream({
        model,
        system:
          'You are a helpful assistant. Reply conversationally and concisely. ' +
          'When a visual would help — metrics, comparisons, lists, summaries — call ' +
          'the renderUI tool instead of describing it in prose. You may call it more ' +
          'than once. Keep your own text brief when you render UI. ' +
          'Whenever you need to clarify, ask the user to choose, or offer next steps, ' +
          'do NOT ask in plain prose — call renderUI to render a Choices component with ' +
          'the options, so the user can pick one and it comes back to you.',
        messages: (history ?? []).map((m) => ({ role: m.role, content: [{ text: m.text }] })),
        prompt: message,
        tools: [renderUI],
      });

      for await (const chunk of stream) {
        const delta = chunk.text;
        if (delta) sendChunk({ type: 'text', delta });
      }
      return (await response).text;
    });

    return { reply, ui: ctx.specs };
  },
);

const port = Number(process.env.PORT ?? 3401);
startFlowServer({ flows: [chat], port, cors: { origin: true } });
console.log(`agentic-chat flow server on http://localhost:${port} (POST /chat)`);
