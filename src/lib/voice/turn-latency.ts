/** Attach Pipecat's perceived_response (user stopped → first audio) to the
 * latest agent turn after the greeting. The greeting is scripted TTS, not a
 * model reply — skip the first agent bubble. */
export function applyPerceivedLatency<T extends { role: string; latencyMs?: number }>(
  turns: T[],
  latencyMs: number,
  agentRole: string,
  opts?: { skipFirst?: boolean },
): { turns: T[]; attached: boolean } {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== agentRole || turns[i].latencyMs !== undefined) continue;
    if (opts?.skipFirst && i === 0) continue;
    const next = turns.slice();
    next[i] = { ...turns[i], latencyMs };
    return { turns: next, attached: true };
  }
  return { turns, attached: false };
}
