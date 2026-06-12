import {
  ActionProvider,
  Renderer,
  type Spec,
  StateProvider,
  VisibilityProvider,
} from '@json-render/react';
import { streamFlow } from 'genkit/beta/client';
import { useCallback, useState } from 'react';
import { registry } from './registry';

const FLOW_URL = '/api/landingPage';

export default function App() {
  const [pitch, setPitch] = useState('A dog-walking SaaS for busy tech workers');
  const [spec, setSpec] = useState<Spec | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const trimmed = pitch.trim();
    if (trimmed.length < 4 || streaming) return;
    setStreaming(true);
    setError(null);
    setSpec(null);
    try {
      const { stream, output } = streamFlow<Spec, Spec>({
        url: FLOW_URL,
        input: { pitch: trimmed },
      });
      for await (const chunk of stream) setSpec(chunk);
      setSpec(await output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setStreaming(false);
    }
  }, [pitch, streaming]);

  const status = streaming
    ? 'STREAMING'
    : spec
      ? `COMPLETE · ${Object.keys(spec.elements).length} elements`
      : 'IDLE';

  return (
    <main className="grid min-h-screen grid-cols-1 gap-6 p-6 md:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-3 md:sticky md:top-6 md:self-start">
        <h1 className="font-mono text-sm">genkitx-json-render</h1>
        <p className="text-sm text-muted-foreground">
          Genkit streams a json-render spec from Gemini; the same shadcn catalog renders it.
        </p>
        <label
          htmlFor="pitch"
          className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Pitch
        </label>
        <textarea
          id="pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          maxLength={400}
          className="resize-none rounded-md border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Describe a product…"
        />
        <button
          type="button"
          onClick={run}
          disabled={streaming || pitch.trim().length < 4}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {streaming ? 'Generating…' : 'Generate landing page'}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">{status}</p>
      </aside>

      <section className="min-h-[70vh] rounded-2xl border bg-card p-8">
        {spec ? (
          <StateProvider initialState={{}}>
            <ActionProvider>
              <VisibilityProvider>
                <Renderer spec={spec} registry={registry} />
              </VisibilityProvider>
            </ActionProvider>
          </StateProvider>
        ) : (
          <div className="grid h-[50vh] place-items-center font-mono text-[13px] text-muted-foreground">
            Describe a product and hit generate.
          </div>
        )}
      </section>
    </main>
  );
}
