import { createContext, useContext } from 'react';

/**
 * Lets a rendered component send a value back to the model as the user's next
 * message — the round-trip that makes the generated UI interactive.
 */
export const RespondContext = createContext<(value: string) => void>(() => {});

export function useRespond() {
  return useContext(RespondContext);
}
