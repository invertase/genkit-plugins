import { useEffect, useRef, useState } from 'react';

/** App chrome — header, empty state, composer. The json-render integration lives in App.tsx. */

const SUGGESTIONS = [
  'Show me Q3 revenue: $1.2M, up 18% from Q2',
  'Compare our Free, Pro and Team plans',
  'Summarize the launch checklist',
  'Plan a team offsite — collect the details in a form',
];

export function Header({ busy }: { busy: boolean }) {
  return (
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
  );
}

export function EmptyState({ onPick }: { onPick: (suggestion: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <h1 className="text-balance text-3xl font-semibold tracking-tight">Ask. Watch it render.</h1>
      <p className="mt-2 max-w-sm text-balance text-muted-foreground">
        The model replies in text and calls the <span className="font-mono">renderUI</span> tool
        when a live component says it better.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => onPick(s)}
            className="cursor-pointer rounded-full border bg-card px-3.5 py-2 text-sm text-foreground/80 transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Thinking() {
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

export function Composer({ busy, onSend }: { busy: boolean; onSend: (text: string) => void }) {
  const [input, setInput] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when input changes
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (!busy) taRef.current?.focus();
  }, [busy]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-md">
      <form
        className="mx-auto max-w-3xl px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
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
                submit();
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
  );
}
