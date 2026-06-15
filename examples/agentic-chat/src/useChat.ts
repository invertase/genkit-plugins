import type { Spec } from '@json-render/react';
import { streamFlow } from 'genkit/beta/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRegistry } from './registry';

const FLOW_URL = '/api/chat';

type ChatChunk = { type: 'text'; delta: string } | { type: 'spec'; id: string; spec: Spec };

export interface Turn {
  id: string;
  role: 'user' | 'model';
  text: string;
  ui?: Spec[];
}

export type ChatRendering = ReturnType<typeof createRegistry>;

/** Render submitted form values as the user's next chat message. */
function formatSubmission(values: Record<string, unknown>): string {
  const lines = Object.entries(values).map(
    ([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
  );
  return lines.length > 0 ? lines.join('\n') : 'Submitted the form.';
}

export function useChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const busy = streamingId !== null;

  // Mirror `turns` in a ref so `send` can read the latest history without
  // depending on it — keeps `send` referentially stable across the stream.
  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Synchronous in-flight guard: `busy` state lags a re-render, so a double
  // click could start two streams before the first setState lands.
  const inFlightRef = useRef(false);

  // Cleared on unmount so an orphaned stream stops consuming and updating state;
  // the AbortController actually cancels the request server-side.
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || inFlightRef.current) return;
    inFlightRef.current = true;

    const history = turnsRef.current.map((t) => ({ role: t.role, text: t.text }));
    const botId = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: message },
      { id: botId, role: 'model', text: '', ui: [] },
    ]);
    setStreamingId(botId);

    const specs = new Map<string, Spec>();
    let acc = '';
    const flush = () =>
      setTurns((prev) =>
        prev.map((t) => (t.id === botId ? { ...t, text: acc, ui: [...specs.values()] } : t)),
      );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { stream } = streamFlow<{ reply: string; ui: Spec[] }, ChatChunk>({
        url: FLOW_URL,
        input: { history, message },
        abortSignal: controller.signal,
      });
      for await (const chunk of stream) {
        if (!aliveRef.current) return;
        if (chunk.type === 'text') acc += chunk.delta;
        else specs.set(chunk.id, chunk.spec);
        flush();
      }
    } catch (err) {
      if (!aliveRef.current) return;
      acc = acc || (err instanceof Error ? err.message : 'Request failed.');
      flush();
    } finally {
      inFlightRef.current = false;
      if (aliveRef.current) setStreamingId(null);
    }
  }, []);

  // `send` is referentially stable, so registry + handlers build once.
  const rendering = useMemo(
    () => createRegistry((values) => send(formatSubmission(values))),
    [send],
  );

  return { busy, rendering, send, streamingId, turns };
}
