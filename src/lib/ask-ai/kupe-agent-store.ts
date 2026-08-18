/** Module-level (not React-context) store for the Kai/Kupe autonomous
 * agent session that backs both the "What should your voice agent do?"
 * create flow (pages/voice-agents/agents/page.tsx) and the in-editor
 * "Ask Kupe" panel (components/voice-agents/agent-ask-kori-panel.tsx).
 *
 * Living outside the component tree is deliberate: creating an agent
 * kicks off a harness turn that keeps running tool calls (attach a voice,
 * set a greeting, ...) after the app navigates from the agents list into
 * the new agent's editor. A React-context-scoped session would have its
 * fetch aborted by that navigation's unmount; this survives it.
 */

import { HARNESS_URL } from "@/config";
import { supabase } from "@/lib/supabase";
import { captureException } from "@/lib/posthog";
import type { AgentStep, ChatTurn, HarnessEvent } from "./types";

type StoreState = {
  sessionId: string | null;
  /** Which agent the current session's next turns should edit, if any. */
  scopeAgentId: string | null;
  turns: ChatTurn[];
  busy: boolean;
  /** Set once a create_agent tool call resolves, so the agents-list page
   * can navigate to it. Cleared by clearCreatedAgent() once consumed. */
  createdAgent: { id: string; name: string } | null;
  error: string | null;
};

let state: StoreState = {
  sessionId: null,
  scopeAgentId: null,
  turns: [],
  busy: false,
  createdAgent: null,
  error: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): StoreState {
  return state;
}

export function clearCreatedAgent() {
  if (state.createdAgent) setState({ createdAgent: null });
}

/** Called when the editor mounts for some agentId. If the store's current
 * session isn't already about this agent (e.g. a stray session for a
 * different agent, or none at all), start clean rather than let an
 * unrelated conversation bleed into this agent's edits. Returns whether
 * the store's turns are already this agent's live creation transcript. */
export function enterAgentScope(agentId: string): boolean {
  const isSameCreation = state.createdAgent?.id === agentId || state.scopeAgentId === agentId;
  if (!isSameCreation) {
    void closeSession();
    state = { sessionId: null, scopeAgentId: agentId, turns: [], busy: false, createdAgent: null, error: null };
    for (const l of listeners) l();
    return false;
  }
  if (state.scopeAgentId !== agentId) setState({ scopeAgentId: agentId });
  return true;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  return headers;
}

async function* readSse(response: Response): AsyncGenerator<HarnessEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        yield JSON.parse(dataLine.slice(5).trim()) as HarnessEvent;
      } catch {
        // malformed frame -- skip rather than kill the whole stream
      }
    }
  }
}

async function ensureSession(orgId: string): Promise<string> {
  if (state.sessionId) return state.sessionId;
  const headers = await authHeaders();
  const resp = await fetch(`${HARNESS_URL}/v1/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ org_id: orgId }),
  });
  if (!resp.ok) throw new Error(`Could not start Kupe: ${resp.status}`);
  const body = (await resp.json()) as { session_id: string };
  setState({ sessionId: body.session_id });
  return body.session_id;
}

export async function closeSession(): Promise<void> {
  const sid = state.sessionId;
  if (!sid) return;
  try {
    const headers = await authHeaders();
    await fetch(`${HARNESS_URL}/v1/sessions/${sid}`, { method: "DELETE", headers });
  } catch {
    // best-effort -- kupe-harness's idle sweeper bills+cleans up either way
  }
}

function newId() {
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function creationPrompt(orgId: string, projectId: string, userText: string): string {
  return [
    "Create a new voice agent for this workspace.",
    `org_id=${orgId} project_id=${projectId}`,
    'Pick a clear, specific name based on what the agent does -- not "New agent" and not the request repeated verbatim (e.g. for a sales agent for an EV charger company, something like "EV Charger Sales Agent").',
    "Write a system_prompt and greeting appropriate for that job, using create_agent, then commit_agent_version once it looks right.",
    "",
    `What the agent should do: ${userText}`,
  ].join("\n");
}

function editPrompt(orgId: string, projectId: string, agentId: string, userText: string): string {
  return [
    "You are editing an existing voice agent -- use update_agent (and commit_agent_version once you're done), never create_agent.",
    `org_id=${orgId} project_id=${projectId} agent_id=${agentId}`,
    "",
    userText,
  ].join("\n");
}

async function runTurn(orgId: string, displayText: string, framedText: string): Promise<void> {
  if (state.busy) return;

  const userTurn: ChatTurn = { id: newId(), role: "user", text: displayText, steps: [], streaming: false };
  const assistantTurn: ChatTurn = { id: newId(), role: "assistant", text: "", steps: [], streaming: true };
  setState((s) => ({ turns: [...s.turns, userTurn, assistantTurn], busy: true, error: null }));

  const patchAssistant = (patch: Partial<ChatTurn> | ((t: ChatTurn) => Partial<ChatTurn>)) => {
    setState((s) => ({
      turns: s.turns.map((t) => (t.id === assistantTurn.id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
    }));
  };
  const pushStep = (step: AgentStep) => {
    setState((s) => ({ turns: s.turns.map((t) => (t.id === assistantTurn.id ? { ...t, steps: [...t.steps, step] } : t)) }));
  };
  const updateLastToolStep = (callId: string, patch: Partial<AgentStep & { kind: "tool_call" }>) => {
    setState((s) => ({
      turns: s.turns.map((t) =>
        t.id !== assistantTurn.id
          ? t
          : { ...t, steps: t.steps.map((step) => (step.kind === "tool_call" && step.callId === callId ? { ...step, ...patch } : step)) },
      ),
    }));
  };

  try {
    const sid = await ensureSession(orgId);
    const headers = await authHeaders();
    const resp = await fetch(`${HARNESS_URL}/v1/sessions/${sid}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: framedText }),
    });
    if (!resp.ok || !resp.body) throw new Error(`Kupe turn failed: ${resp.status}`);

    for await (const event of readSse(resp)) {
      switch (event.type) {
        case "reasoning":
          pushStep({ kind: "reasoning", text: event.text });
          break;
        case "tool_call":
          pushStep({ kind: "tool_call", name: event.name, arguments: event.arguments, callId: event.call_id, done: false });
          break;
        case "tool_result": {
          updateLastToolStep(event.call_id, { result: event.result, isError: event.is_error, done: true });
          if (event.name === "create_agent" && !event.is_error) {
            try {
              const parsed = JSON.parse(event.result) as { id?: string; name?: string };
              if (parsed?.id) setState({ createdAgent: { id: parsed.id, name: parsed.name ?? "" } });
            } catch {
              // create_agent's own result parse failure shouldn't break the turn
            }
          }
          break;
        }
        case "message_delta":
          patchAssistant((t) => ({ text: t.text + event.text }));
          break;
        case "message":
          patchAssistant({ text: event.text });
          break;
        case "done":
          patchAssistant({ streaming: false });
          break;
        case "error":
          patchAssistant({ streaming: false, error: event.detail });
          break;
      }
    }
  } catch (err) {
    captureException(err, { source: "kupe-agent-store" });
    patchAssistant({ streaming: false, error: err instanceof Error ? err.message : "Something went wrong" });
    setState({ error: err instanceof Error ? err.message : "Something went wrong" });
  } finally {
    setState({ busy: false });
  }
}

export function sendForNewAgent(orgId: string, projectId: string, userText: string): Promise<void> {
  setState({ scopeAgentId: null });
  return runTurn(orgId, userText, creationPrompt(orgId, projectId, userText));
}

export function sendForAgent(orgId: string, projectId: string, agentId: string, userText: string): Promise<void> {
  setState({ scopeAgentId: agentId });
  return runTurn(orgId, userText, editPrompt(orgId, projectId, agentId, userText));
}

export function resetSession(): void {
  void closeSession();
  state = { sessionId: null, scopeAgentId: null, turns: [], busy: false, createdAgent: null, error: null };
  for (const l of listeners) l();
}
