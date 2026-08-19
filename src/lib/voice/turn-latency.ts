/** Attach Pipecat's perceived_response (user stopped → first audio) to the
 * latest agent turn. The event often lands after the transcript is already
 * on screen, so we patch the last unlabeled agent bubble instead of waiting
 * for the next turn. */
export function applyPerceivedLatency<T extends { role: string; latencyMs?: number }>(
  turns: T[],
  latencyMs: number,
  agentRole: string,
): { turns: T[]; attached: boolean } {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === agentRole && turns[i].latencyMs === undefined) {
      const next = turns.slice();
      next[i] = { ...turns[i], latencyMs };
      return { turns: next, attached: true };
    }
  }
  return { turns, attached: false };
}
