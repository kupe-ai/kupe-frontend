import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe } from "./kupe-agent-store";

/** Subscribes a component to the module-level Kai/Kupe agent store (see
 * kupe-agent-store.ts) -- read-only; call the store's exported functions
 * (sendForNewAgent, sendForAgent, enterAgentScope, resetSession, ...)
 * directly to mutate it. */
export function useKupeAgentStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
