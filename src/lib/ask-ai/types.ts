/** Mirrors kupe-harness's SSE event shapes 1:1 (see kupe-harness/app/agent_loop.py). */
export type HarnessEvent =
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown>; call_id: string }
  | { type: "tool_result"; name: string; call_id: string; result: string; is_error: boolean }
  | { type: "message_delta"; text: string }
  | { type: "message"; text: string }
  | { type: "done"; finish_reason: string }
  | { type: "error"; detail: string };

/** One step in a turn's timeline -- reasoning text or a tool call/result
 * pair, rendered as the collapsible "Agent steps" list. */
export type AgentStep =
  | { kind: "reasoning"; text: string }
  | { kind: "tool_call"; name: string; arguments: Record<string, unknown>; callId: string; result?: string; isError?: boolean; done: boolean };

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps: AgentStep[];
  streaming: boolean;
  error?: string;
};
