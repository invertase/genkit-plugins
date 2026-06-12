import {
  ActionProvider,
  Renderer,
  type Spec,
  StateProvider,
  VisibilityProvider,
} from '@json-render/react';
import { streamFlow } from 'genkit/beta/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registry } from './registry';
import { RespondContext } from './respond';

const FLOW_URL = '/api/chat';

type ChatChunk = { type: 'text'; delta: string } | { type: 'spec'; id: string; spec: Spec };

interface Turn {
  id: string;
  role: 'user' | 'model';
  text: string;
  ui?: Spec[];
}

const SUGGESTIONS = [
  'Show me Q3 revenue: $1.2M, up 18% from Q2',
  'Compare our Free, Pro and Team plans',
  'Summarize the launch checklist',
];

/** Drop child refs to not-yet-streamed elements so partial specs render safely. */
function sanitize(spec: Spec): Spec | null {
  const els = (spec.elements ?? {}) as unknown as Record<
    string,
    { children?: string[] } & Record<string, unknown>
  >;
  if (!spec.root || !(spec.root in els)) return null;
  const out: typeof els = {};
  for (const [id, el] of Object.entries(els)) {
    out[id] = Array.isArray(el.children)
      ? { ...el, children: el.children.filter((c) => c in els) }
      : el;
  }
  return { ...spec, elements: out } as unknown as Spec;
}

function RenderedSpec({ spec }: { spec: Spec }) {
  const state = spec.state ?? {};
  // Seed from the spec's own state and remount when it changes, so components
  // bound to $state (e.g. a Chart's data) resolve as the state streams in.
  return (
    <StateProvider key={JSON.stringify(state)} initialState={state}>
      <ActionProvider>
        <VisibilityProvider>
          <Renderer spec={spec} registry={registry} />
        </VisibilityProvider>
      </ActionProvider>
    </StateProvider>
  );
}

/** The agentic moment, made legible: shows the model's renderUI tool-call. */
function Artifact({ spec }: { spec: Spec }) {
  const safe = sanitize(spec);
  if (!safe) return null;
  return (
    <figure className="m-0 mt-3">
      <figcaption className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <span className="text-primary">↳</span>
        <span>renderUI</span>
        <span className="text-border">·</span>
        <span>{Object.keys(safe.elements).length} elements</span>
      </figcaption>
      <div className="jr-canvas">
        <RenderedSpec spec={safe} />
      </div>
    </figure>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
      <span className="size-3 animate-spin rounded-full border-2 border-muted border-t-primary" />
      thinking
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 12.5V4M8 4 4.5 7.5M8 4l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = streamingId !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keep pinned to the latest content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when input changes
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const history = turns.map((t) => ({ role: t.role, text: t.text }));
      const botId = crypto.randomUUID();
      setTurns((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', text: message },
        { id: botId, role: 'model', text: '', ui: [] },
      ]);
      setInput('');
      setStreamingId(botId);

      const specs = new Map<string, Spec>();
      let acc = '';
      const flush = () =>
        setTurns((prev) =>
          prev.map((t) => (t.id === botId ? { ...t, text: acc, ui: [...specs.values()] } : t)),
        );

      try {
        const { stream } = streamFlow<{ reply: string; ui: Spec[] }, ChatChunk>({
          url: FLOW_URL,
          input: { history, message },
        });
        for await (const chunk of stream) {
          if (chunk.type === 'text') acc += chunk.delta;
          else specs.set(chunk.id, chunk.spec);
          flush();
        }
      } catch (err) {
        acc = acc || (err instanceof Error ? err.message : 'Request failed.');
        flush();
      } finally {
        setStreamingId(null);
        taRef.current?.focus();
      }
    },
    [turns, busy],
  );

  const empty = turns.length === 0;

  return (
    <RespondContext.Provider value={send}>
      <div className="flex h-dvh flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold tracking-tight">json-render</span>
              <span className="font-mono text-[11px] text-muted-foreground">agentic UI</span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              <span
                className={`size-1.5 rounded-full bg-primary ${busy ? 'animate-pulse' : ''}`}
                aria-hidden="true"
              />
              gemini-2.5-flash
            </span>
          </div>
        </header>

        {/* transcript */}
        <div ref={scrollRef} className="scroll-soft flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 pb-6">
            {empty ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <h1 className="text-balance text-3xl font-semibold tracking-tight">
                  Ask. Watch it render.
                </h1>
                <p className="mt-2 max-w-sm text-balance text-muted-foreground">
                  The model replies in text and calls the{' '}
                  <span className="font-mono">renderUI</span> tool when a live component says it
                  better.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => send(s)}
                      className="cursor-pointer rounded-full border bg-card px-3.5 py-2 text-sm text-foreground/80 transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 py-6">
                {turns.map((turn) =>
                  turn.role === 'user' ? (
                    <div key={turn.id} className="animate-rise flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm whitespace-pre-wrap text-background">
                        {turn.text}
                      </div>
                    </div>
                  ) : (
                    <div key={turn.id} className="animate-rise max-w-[92%]">
                      {turn.text && (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                          {turn.text}
                        </p>
                      )}
                      {turn.ui?.map((spec, i) => (
                        <Artifact key={`${turn.id}-${spec.root || i}`} spec={spec} />
                      ))}
                      {streamingId === turn.id && !turn.text && !turn.ui?.length && (
                        <div className="mt-1">
                          <Thinking />
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-md">
          <form
            className="mx-auto max-w-3xl px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 pl-4 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-md focus-within:ring-4 focus-within:ring-primary/10">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask for something visual…"
                disabled={busy}
                className="no-scrollbar max-h-40 flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
              >
                <SendIcon />
              </button>
            </div>
            <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground">
              powered by genkitx-json-render
            </p>
          </form>
        </div>
      </div>
    </RespondContext.Provider>
  );
}
