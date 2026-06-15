import {
  ActionProvider,
  Renderer,
  type Spec,
  StateProvider,
  ValidationProvider,
  VisibilityProvider,
} from '@json-render/react';
import type { ChatRendering, Turn } from '../useChat';
import { Thinking } from './chrome';

function RenderedSpec({ spec, rendering }: { spec: Spec; rendering: ChatRendering }) {
  const state = spec.state ?? {};
  // Seed from the spec's own state and remount when it changes, so components
  // bound to $state (e.g. a Chart's data) resolve as the state streams in.
  // Form fields ($bindState) write into this StateProvider; the submit action
  // reads the collected values back out via its { $state: "/form" } param.
  return (
    <StateProvider key={JSON.stringify(state)} initialState={state}>
      <ActionProvider handlers={rendering.handlers}>
        <ValidationProvider>
          <VisibilityProvider>
            <Renderer spec={spec} registry={rendering.registry} />
          </VisibilityProvider>
        </ValidationProvider>
      </ActionProvider>
    </StateProvider>
  );
}

/** The agentic moment, made legible: shows the model's renderUI tool-call. */
function Artifact({ spec, rendering }: { spec: Spec; rendering: ChatRendering }) {
  return (
    <figure className="m-0 mt-3">
      <figcaption className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <span className="text-primary">↳</span>
        <span>renderUI</span>
        <span className="text-border">·</span>
        <span>{Object.keys(spec.elements).length} elements</span>
      </figcaption>
      <div className="jr-canvas">
        <RenderedSpec spec={spec} rendering={rendering} />
      </div>
    </figure>
  );
}

function UserTurn({ turn }: { turn: Turn }) {
  return (
    <div className="animate-rise flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm whitespace-pre-wrap text-background">
        {turn.text}
      </div>
    </div>
  );
}

function ModelTurn({
  rendering,
  streaming,
  turn,
}: {
  rendering: ChatRendering;
  streaming: boolean;
  turn: Turn;
}) {
  return (
    <div className="animate-rise max-w-[92%]">
      {turn.text && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{turn.text}</p>}
      {turn.ui?.map((spec, i) => (
        <Artifact key={`${turn.id}-${spec.root || i}`} spec={spec} rendering={rendering} />
      ))}
      {streaming && !turn.text && !turn.ui?.length && (
        <div className="mt-1">
          <Thinking />
        </div>
      )}
    </div>
  );
}

export function ChatTranscript({
  rendering,
  streamingId,
  turns,
}: {
  rendering: ChatRendering;
  streamingId: string | null;
  turns: Turn[];
}) {
  return (
    <div className="flex flex-col gap-5 py-6">
      {turns.map((turn) =>
        turn.role === 'user' ? (
          <UserTurn key={turn.id} turn={turn} />
        ) : (
          <ModelTurn
            key={turn.id}
            rendering={rendering}
            streaming={streamingId === turn.id}
            turn={turn}
          />
        ),
      )}
    </div>
  );
}
