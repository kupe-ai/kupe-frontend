import { useCallback, useEffect, useRef, useState } from "react";
import { HARNESS_URL } from "@/config";
import { supabase } from "@/lib/supabase";
import { captureException } from "@/lib/posthog";
import { useWorkspaceOptional } from "@/context/workspace-context";
import type { AgentStep, ChatTurn, HarnessEvent } from "./types";

/** Parses a `text/event-stream` body into `{event, data}` frames. Not a
 * generic SSE client -- just enough for kupe-harness's `event: <type>\n
 * data: <json>\n\n` framing, read via fetch so we can send our own
 * Authorization header (EventSource can't) and a POST body. */
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

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  return headers;
}

function newId() {
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function useKupeAgent() {
  const workspace = useWorkspaceOptional();
  const orgId = workspace?.org?.id;
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const closeSession = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    if (!sid) return;
    try {
      const headers = await authHeaders();
      await fetch(`${HARNESS_URL}/v1/sessions/${sid}`, { method: "DELETE", headers });
    } catch {
      // best-effort -- kupe-harness's own idle sweeper cleans up and bills
      // an abandoned session either way.
    }
  }, []);

  // Refresh/unmount: stop whatever turn is in flight and close the
  // session so the harness doesn't keep an org's own agent looping in the
  // background with nobody watching.
  useEffect(() => {
    const onUnload = () => {
      abortRef.current?.abort();
      const sid = sessionIdRef.current;
      if (sid) {
        void supabase.auth.getSession().then(({ data }) => {
          const token = data.session?.access_token;
          navigator.sendBeacon?.(
            `${HARNESS_URL}/v1/sessions/${sid}`,
            new Blob([JSON.stringify({})], { type: "application/json" }),
          );
          void token; // sendBeacon can't carry an Authorization header; best-effort only
        });
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void closeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (!orgId) throw new Error("No workspace selected");
    const headers = await authHeaders();
    const resp = await fetch(`${HARNESS_URL}/v1/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ org_id: orgId }),
    });
    if (!resp.ok) throw new Error(`Could not start Kupe: ${resp.status}`);
    const body = (await resp.json()) as { session_id: string };
    sessionIdRef.current = body.session_id;
    return body.session_id;
  }, [orgId]);

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || busy) return;

      const userTurn: ChatTurn = { id: newId(), role: "user", text: trimmed, steps: [], streaming: false };
      const assistantTurn: ChatTurn = { id: newId(), role: "assistant", text: "", steps: [], streaming: true };
      setTurns((t) => [...t, userTurn, assistantTurn]);
      setBusy(true);

      const patchAssistant = (patch: Partial<ChatTurn> | ((t: ChatTurn) => Partial<ChatTurn>)) => {
        setTurns((all) =>
          all.map((t) => (t.id === assistantTurn.id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
        );
      };
      const pushStep = (step: AgentStep) => {
        setTurns((all) =>
          all.map((t) => (t.id === assistantTurn.id ? { ...t, steps: [...t.steps, step] } : t)),
        );
      };
      const updateLastToolStep = (callId: string, patch: Partial<AgentStep & { kind: "tool_call" }>) => {
        setTurns((all) =>
          all.map((t) => {
            if (t.id !== assistantTurn.id) return t;
            return {
              ...t,
              steps: t.steps.map((s) => (s.kind === "tool_call" && s.callId === callId ? { ...s, ...patch } : s)),
            };
          }),
        );
      };

      try {
        const sid = await ensureSession();
        const headers = await authHeaders();
        const controller = new AbortController();
        abortRef.current = controller;

        const resp = await fetch(`${HARNESS_URL}/v1/sessions/${sid}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify({ message: trimmed }),
          signal: controller.signal,
        });
        if (!resp.ok || !resp.body) {
          throw new Error(`Kupe turn failed: ${resp.status}`);
        }

        for await (const event of readSse(resp)) {
          switch (event.type) {
            case "reasoning":
              pushStep({ kind: "reasoning", text: event.text });
              break;
            case "tool_call":
              pushStep({ kind: "tool_call", name: event.name, arguments: event.arguments, callId: event.call_id, done: false });
              break;
            case "tool_result":
              updateLastToolStep(event.call_id, { result: event.result, isError: event.is_error, done: true });
              break;
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
        if ((err as Error)?.name !== "AbortError") {
          captureException(err, { source: "ask-ai" });
          patchAssistant({ streaming: false, error: err instanceof Error ? err.message : "Something went wrong" });
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, ensureSession],
  );

  const reset = useCallback(() => {
    void closeSession();
    setTurns([]);
  }, [closeSession]);

  return { turns, busy, sendMessage, reset, hasWorkspace: Boolean(orgId) };
}
