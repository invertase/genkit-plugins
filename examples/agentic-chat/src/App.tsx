import { useEffect, useRef } from 'react';
import { RespondContext } from './respond';
import { ChatTranscript } from './ui/chat';
import { Composer, EmptyState, Header } from './ui/chrome';
import { useChat } from './useChat';

export default function App() {
  const { busy, rendering, send, streamingId, turns } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keep pinned to the latest content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const empty = turns.length === 0;

  return (
    <RespondContext.Provider value={send}>
      <div className="flex h-dvh flex-col">
        <Header busy={busy} />

        {/* transcript */}
        <div ref={scrollRef} className="scroll-soft flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 pb-6">
            {empty ? (
              <EmptyState onPick={send} />
            ) : (
              <ChatTranscript rendering={rendering} streamingId={streamingId} turns={turns} />
            )}
          </div>
        </div>

        <Composer busy={busy} onSend={send} />
      </div>
    </RespondContext.Provider>
  );
}
