import { startFlowServer } from '@genkit-ai/express';
import { googleAI } from '@genkit-ai/google-genai';
import type { Spec } from '@json-render/core';
import { type ActionContext, genkit, z } from 'genkit';
import { defineRenderTool, sanitizePartialSpec } from 'genkitx-json-render';
import { catalog } from '../src/catalog';

// Reads GOOGLE_GENAI_API_KEY from the environment (see .env.example).
const ai = genkit({ plugins: [googleAI()] });

const model = googleAI.model('gemini-2.5-flash');

/** One streamed chunk: an assistant text delta, or a (possibly partial) UI spec. */
type ChatChunk = { type: 'text'; delta: string } | { type: 'spec'; id: string; spec: Spec };

/**
 * Per-request streaming channel, passed to the renderUI tool through Genkit's
 * action context (`ai.generateStream({ context })` propagates it into tools).
 */
interface ChatChannel {
  send: (chunk: ChatChunk) => void;
  specs: Spec[];
}

const channel = (context?: ActionContext) => context?.chat as ChatChannel | undefined;

const renderUI = defineRenderTool(ai, {
  name: 'renderUI',
  description:
    'Render a small UI card to show the user — stats, lists, callouts, summaries, ' +
    'or a form to collect structured input. Call this whenever a visual would ' +
    'communicate better than prose. The "intent" should fully describe the UI to ' +
    'build, including any concrete data.',
  catalog,
  model,
  instructions: {
    rules: [
      'Never use emoji. For visual cues, use the Icon component (lucide icons).',
      'Lead metrics with a Heading; keep cards focused and scannable.',
      'Display components take literal values in their props — only bind state for form fields.',
      'To collect input, build a form: seed defaults in state under /form, bind each ' +
        'field with { "$bindState": "/form/<name>" }, and end with a Button whose ' +
        'on is { "press": { "action": "submit", "params": { "values": { "$state": "/form" } } } }.',
      'Use Choices for a single quick pick; use a form for multiple fields or free-text input.',
    ],
  },
  // Partials are render-safe (the plugin prunes dangling children) — push live.
  onPartial: (spec, _input, { context }) => {
    channel(context)?.send({ type: 'spec', id: spec.root, spec });
  },
  // Re-send the final spec (authoritative) and record it for the flow output.
  onSpec: (spec, _input, { context }) => {
    const chat = channel(context);
    const safe = sanitizePartialSpec(spec);
    if (!chat || !safe) return;
    chat.send({ type: 'spec', id: safe.root, spec: safe });
    chat.specs.push(safe);
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
  async ({ history, message }, { context, sendChunk, abortSignal }) => {
    const chatChannel: ChatChannel = { send: sendChunk, specs: [] };

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
      context: { ...context, chat: chatChannel },
      abortSignal,
    });

    for await (const chunk of stream) {
      const delta = chunk.text;
      if (delta) sendChunk({ type: 'text', delta });
    }

    return { reply: (await response).text, ui: chatChannel.specs };
  },
);

const port = Number(process.env.PORT ?? 3401);
startFlowServer({ flows: [chat], port, cors: { origin: true } });
console.log(`agentic-chat flow server on http://localhost:${port} (POST /chat)`);
