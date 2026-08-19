/** Module-level (not React-context) store for the Kai/Kupe autonomous
 * agent session that backs both the "What should your voice agent do?"
 * create flow (pages/voice-agents/agents/page.tsx) and the in-editor
 * "Ask Kai" panel (components/voice-agents/agent-ask-kori-panel.tsx).
 *
 * Living outside the component tree is deliberate: creating an agent
 * kicks off a harness turn that keeps running tool calls (attach a voice,
 * set a greeting, ...) after the app navigates from the agents list into
 * the new agent's editor. A React-context-scoped session would have its
 * fetch aborted by that navigation's unmount; this survives it.
 */

import { HARNESS_URL } from "@/config";
import { supabase } from "@/lib/supabase";
import { isAbortError, isBrowserNetworkError } from "@/lib/network-error";
import { captureEvent, captureException } from "@/lib/posthog";
import { sanitizeChatError } from "./public-error";
import { readSse } from "./sse";
import type { AgentStep, AttachedFile, ChatTurn, HarnessEvent } from "./types";

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
  attachments: AttachedFile[];
};

let state: StoreState = {
  sessionId: null,
  scopeAgentId: null,
  turns: [],
  busy: false,
  createdAgent: null,
  error: null,
  attachments: [],
};
const listeners = new Set<() => void>();
/** Bumped whenever we throw away the current session so an in-flight
 * runTurn (whose SSE fetch will then fail with TypeError: Failed to fetch)
 * does not patch the replacement state or report that abort to PostHog. */
let turnEpoch = 0;
let abortController: AbortController | null = null;
let lastToken: string | null = null;

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

function abandonCurrentTurn() {
  turnEpoch += 1;
  abortController?.abort();
  abortController = null;
  void closeSession();
}

/** Called when the editor mounts for some agentId. If the store's current
 * session isn't already about this agent (e.g. a stray session for a
 * different agent, or none at all), start clean rather than let an
 * unrelated conversation bleed into this agent's edits. Returns whether
 * the store's turns are already this agent's live creation transcript.
 *
 * Matching uses scopeAgentId (set as soon as create_agent resolves) as
 * well as createdAgent -- the agents-list page consumes createdAgent
 * before navigate, so relying on that flag alone would kill the still-
 * streaming creation turn and surface TypeError: Failed to fetch. */
export function enterAgentScope(agentId: string): boolean {
  const isSameCreation = state.createdAgent?.id === agentId || state.scopeAgentId === agentId;
  if (!isSameCreation) {
    abandonCurrentTurn();
    state = {
      sessionId: null,
      scopeAgentId: agentId,
      turns: [],
      busy: false,
      createdAgent: null,
      error: null,
      attachments: [],
    };
    for (const l of listeners) l();
    return false;
  }
  if (state.scopeAgentId !== agentId) setState({ scopeAgentId: agentId });
  return true;
}

async function authHeaders(json = true): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  lastToken = token;
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function sseHeaders(): Promise<HeadersInit> {
  return authHeaders(true).then((h) => ({
    ...h,
    Accept: "text/event-stream",
    "Cache-Control": "no-store",
  }));
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
  setState({ sessionId: null });
  try {
    const headers = await authHeaders();
    await fetch(`${HARNESS_URL}/v1/sessions/${sid}`, { method: "DELETE", headers, keepalive: true });
  } catch {
    // best-effort -- kupe-harness's idle sweeper bills+cleans up either way
  }
}

function closeSessionSync() {
  abortController?.abort();
  abortController = null;
  const sid = state.sessionId;
  if (!sid || !lastToken) return;
  void fetch(`${HARNESS_URL}/v1/sessions/${sid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${lastToken}` },
    keepalive: true,
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", closeSessionSync);
}

function newId() {
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function creationPrompt(orgId: string, projectId: string, userText: string): string {
  return [
    "Create a new voice agent for this workspace.",
    `org_id=${orgId} project_id=${projectId}`,
    'Name it with a real first name (the speaking persona — e.g. "Kavya", "Rohan"), never a job-title slug like "EV Charger Sales Agent" or "New agent".',
    "Write a spoken-voice system_prompt (under ~1000 tokens, follow create_agent's voice-prompt rules: Identity→Closing in Title Case, You are {name}… persona, {{camelCase}} input variables in the prompt and greeting, config.variables declared) and a one-line greeting. Call set_agent_output_variables for any post-call targets, then commit_agent_version once it looks right.",
    "Put long product catalogs / FAQs in a knowledge base and attach via config.knowledge_base_ids — not in the prompt.",
    "",
    `What the agent should do: ${userText}`,
  ].join("\n");
}

function editPrompt(orgId: string, projectId: string, agentId: string, userText: string): string {
  return [
    "You are editing an existing voice agent -- use update_agent (and commit_agent_version once you're done), never create_agent.",
    `org_id=${orgId} project_id=${projectId} agent_id=${agentId}`,
    "If you change system_prompt or name: keep a real first-name persona, spoken-voice prompt under ~1000 tokens in Identity→Closing order (follow update_agent's voice-prompt rules), with {{camelCase}} input variables in the prompt/greeting and config.variables declared. Call set_agent_output_variables for post-call targets. Extra facts go in a knowledge base, not the prompt.",
    "",
    userText,
  ].join("\n");
}

function applyEvent(assistantId: string, event: HarnessEvent, patchAssistant: (p: Partial<ChatTurn> | ((t: ChatTurn) => Partial<ChatTurn>)) => void) {
  switch (event.type) {
    case "status":
      patchAssistant({ status: event.text });
      break;
    case "reasoning":
      setState((s) => ({
        turns: s.turns.map((t) => {
          if (t.id !== assistantId) return t;
          const last = t.steps[t.steps.length - 1];
          if (last?.kind === "reasoning") {
            const steps = t.steps.slice(0, -1);
            steps.push({ kind: "reasoning", text: last.text + event.text });
            return { ...t, steps };
          }
          return { ...t, steps: [...t.steps, { kind: "reasoning", text: event.text }] };
        }),
      }));
      break;
    case "tool_call":
      setState((s) => ({
        turns: s.turns.map((t) => {
          if (t.id !== assistantId) return t;
          const exists = t.steps.some((step) => step.kind === "tool_call" && step.callId === event.call_id);
          if (exists) {
            return {
              ...t,
              steps: t.steps.map((step) =>
                step.kind === "tool_call" && step.callId === event.call_id
                  ? { ...step, name: event.name || step.name, arguments: event.arguments ?? step.arguments }
                  : step,
              ),
            };
          }
          const step: AgentStep = {
            kind: "tool_call",
            name: event.name,
            arguments: event.arguments,
            callId: event.call_id,
            done: false,
          };
          return { ...t, steps: [...t.steps, step] };
        }),
      }));
      break;
    case "tool_result":
      setState((s) => ({
        turns: s.turns.map((t) =>
          t.id !== assistantId
            ? t
            : {
                ...t,
                steps: t.steps.map((step) =>
                  step.kind === "tool_call" && step.callId === event.call_id
                    ? { ...step, result: event.result, isError: event.is_error, done: true }
                    : step,
                ),
              },
        ),
      }));
      if (event.name === "create_agent" && !event.is_error) {
        try {
          const parsed = JSON.parse(event.result) as { id?: string; name?: string };
          if (parsed?.id) {
            setState({ createdAgent: { id: parsed.id, name: parsed.name ?? "" }, scopeAgentId: parsed.id });
          }
        } catch {
          // create_agent's own result parse failure shouldn't break the turn
        }
      }
      break;
    case "message_delta":
      patchAssistant((t) => ({ text: t.text + event.text }));
      break;
    case "message":
      patchAssistant({ text: event.text });
      break;
    case "done":
      patchAssistant({ streaming: false, status: undefined });
      break;
    case "error": {
      const friendly = sanitizeChatError(event.detail);
      // Harness already captured the real LlmError. Do not open a second
      // PostHog issue grouped on this public copy.
      captureEvent("kupe_agent_turn_error", {
        source: "kupe-agent-store",
        code: event.code,
        public_detail: friendly,
      });
      patchAssistant({ streaming: false, error: friendly, status: undefined });
      setState({ error: friendly });
      break;
    }
  }
}

async function runTurn(orgId: string, displayText: string, framedText: string): Promise<void> {
  if (state.busy) return;
  const epoch = turnEpoch;
  const attachmentIds = state.attachments.map((a) => a.file_id);

  const userTurn: ChatTurn = { id: newId(), role: "user", text: displayText, steps: [], streaming: false };
  const assistantTurn: ChatTurn = { id: newId(), role: "assistant", text: "", steps: [], streaming: true };
  setState((s) => ({ turns: [...s.turns, userTurn, assistantTurn], busy: true, error: null, attachments: [] }));

  const patchAssistant = (patch: Partial<ChatTurn> | ((t: ChatTurn) => Partial<ChatTurn>)) => {
    setState((s) => ({
      turns: s.turns.map((t) => (t.id === assistantTurn.id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
    }));
  };

  const finish = (extra?: Partial<ChatTurn>) => {
    patchAssistant({ streaming: false, ...extra });
  };

  try {
    const sid = await ensureSession(orgId);
    const headers = await sseHeaders();
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const resp = await fetch(`${HARNESS_URL}/v1/sessions/${sid}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: framedText, attachment_ids: attachmentIds }),
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) throw new Error(`Kupe turn failed: ${resp.status}`);

    for await (const event of readSse(resp)) {
      if (epoch !== turnEpoch) continue;
      applyEvent(assistantTurn.id, event, patchAssistant);
    }
    if (epoch === turnEpoch) finish();
  } catch (err) {
    if (epoch !== turnEpoch) return;
    if (isAbortError(err)) {
      finish();
      return;
    }
    if (!isBrowserNetworkError(err)) {
      captureException(err, { source: "kupe-agent-store" });
    }
    const friendly = sanitizeChatError(err);
    finish({ error: friendly });
    setState({ error: friendly });
  } finally {
    if (epoch === turnEpoch) {
      abortController = null;
      setState({ busy: false });
    }
  }
}

export async function uploadAttachment(orgId: string, file: File): Promise<void> {
  const sid = await ensureSession(orgId);
  const headers = await authHeaders(false);
  const body = new FormData();
  body.append("file", file);
  const resp = await fetch(`${HARNESS_URL}/v1/sessions/${sid}/files`, { method: "POST", headers, body });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(detail || `Upload failed: ${resp.status}`);
  }
  const meta = (await resp.json()) as AttachedFile;
  setState((s) => ({ attachments: [...s.attachments, meta] }));
}

export function removeAttachment(fileId: string) {
  setState((s) => ({ attachments: s.attachments.filter((a) => a.file_id !== fileId) }));
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
  abandonCurrentTurn();
  state = { sessionId: null, scopeAgentId: null, turns: [], busy: false, createdAgent: null, error: null, attachments: [] };
  for (const l of listeners) l();
}
