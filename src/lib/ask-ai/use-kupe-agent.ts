import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { HARNESS_URL } from "@/config";
import { supabase } from "@/lib/supabase";
import { isAbortError, isBrowserNetworkError } from "@/lib/network-error";
import { captureEvent, captureException } from "@/lib/posthog";
import { useWorkspaceOptional } from "@/context/workspace-context";
import { sanitizeChatError } from "./public-error";
import { readSse } from "./sse";
import type { AgentStep, AttachedFile, ChatTurn, HarnessEvent } from "./types";

async function authHeaders(json = true): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function newId() {
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function applyHarnessEvent(
  setTurns: Dispatch<SetStateAction<ChatTurn[]>>,
  assistantId: string,
  event: HarnessEvent,
) {
  setTurns((all) =>
    all.map((t) => {
      if (t.id !== assistantId) return t;
      switch (event.type) {
        case "status":
          return { ...t, status: event.text };
        case "reasoning": {
          const last = t.steps[t.steps.length - 1];
          if (last?.kind === "reasoning") {
            const steps = t.steps.slice(0, -1);
            steps.push({ kind: "reasoning", text: last.text + event.text });
            return { ...t, steps };
          }
          return { ...t, steps: [...t.steps, { kind: "reasoning", text: event.text }] };
        }
        case "tool_call": {
          const exists = t.steps.some((s) => s.kind === "tool_call" && s.callId === event.call_id);
          if (exists) {
            return {
              ...t,
              steps: t.steps.map((s) =>
                s.kind === "tool_call" && s.callId === event.call_id
                  ? { ...s, name: event.name || s.name, arguments: event.arguments ?? s.arguments }
                  : s,
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
        }
        case "tool_result":
          return {
            ...t,
            steps: t.steps.map((s) =>
              s.kind === "tool_call" && s.callId === event.call_id
                ? { ...s, result: event.result, isError: event.is_error, done: true }
                : s,
            ),
          };
        case "message_delta":
          return { ...t, text: t.text + event.text };
        case "message":
          return { ...t, text: event.text };
        case "done":
          return { ...t, streaming: false, status: undefined };
        case "error": {
          const friendly = sanitizeChatError(event.detail);
          captureEvent("kupe_agent_turn_error", {
            source: "ask-ai",
            code: event.code,
            public_detail: friendly,
          });
          return { ...t, streaming: false, error: friendly, status: undefined };
        }
        default:
          return t;
      }
    }),
  );
}

export function useKupeAgent() {
  const workspace = useWorkspaceOptional();
  const orgId = workspace?.org?.id;
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef<string | null>(null);

  const closeSession = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    if (!sid) return;
    try {
      const headers = await authHeaders();
      await fetch(`${HARNESS_URL}/v1/sessions/${sid}`, { method: "DELETE", headers, keepalive: true });
    } catch {
      // best-effort -- kupe-harness's own idle sweeper cleans up and bills
      // an abandoned session either way.
    }
  }, []);

  useEffect(() => {
    const onUnload = () => {
      abortRef.current?.abort();
      const sid = sessionIdRef.current;
      const token = tokenRef.current;
      if (sid && token) {
        void fetch(`${HARNESS_URL}/v1/sessions/${sid}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
      }
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      void closeSession();
    };
  }, [closeSession]);

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

  const uploadAttachment = useCallback(
    async (file: File) => {
      const headers = await authHeaders(false);
      const form = new FormData();
      form.append("file", file);
      const upload = (id: string) =>
        fetch(`${HARNESS_URL}/v1/sessions/${id}/files`, { method: "POST", headers, body: form });

      let resp = await upload(await ensureSession());
      // Same stale-session recovery as sendMessage: the harness drops sessions
      // from memory, so an upload can land after ours is already gone.
      if (resp.status === 403 || resp.status === 404) {
        sessionIdRef.current = null;
        resp = await upload(await ensureSession());
      }
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const meta = (await resp.json()) as AttachedFile;
      setAttachments((a) => [...a, meta]);
    },
    [ensureSession],
  );

  const removeAttachment = useCallback((fileId: string) => {
    setAttachments((a) => a.filter((f) => f.file_id !== fileId));
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || busy) return;

      const attachmentIds = attachments.map((a) => a.file_id);
      setAttachments([]);

      const userTurn: ChatTurn = { id: newId(), role: "user", text: trimmed, steps: [], streaming: false };
      const assistantTurn: ChatTurn = { id: newId(), role: "assistant", text: "", steps: [], streaming: true };
      setTurns((t) => [...t, userTurn, assistantTurn]);
      setBusy(true);

      try {
        const sid = await ensureSession();
        const headers = await authHeaders();
        const { data } = await supabase.auth.getSession();
        tokenRef.current = data.session?.access_token ?? null;
        const controller = new AbortController();
        abortRef.current = controller;

        const postTurn = (id: string) =>
          fetch(`${HARNESS_URL}/v1/sessions/${id}/messages`, {
            method: "POST",
            headers: { ...headers, Accept: "text/event-stream", "Cache-Control": "no-store" },
            body: JSON.stringify({ message: trimmed, attachment_ids: attachmentIds }),
            signal: controller.signal,
          });

        let resp = await postTurn(sid);
        // The harness holds sessions in memory, so ours is gone whenever it
        // restarts, sweeps us as idle, or evicts us at capacity (404); 403 is
        // the same story after a JWT refresh. Both mean the cached id is dead,
        // not that the turn is impossible -- clear it and recreate once.
        if (resp.status === 403 || resp.status === 404) {
          sessionIdRef.current = null;
          resp = await postTurn(await ensureSession());
        }
        if (!resp.ok || !resp.body) {
          throw new Error(`Kupe turn failed: ${resp.status}`);
        }

        for await (const event of readSse(resp)) {
          applyHarnessEvent(setTurns, assistantTurn.id, event);
        }
        setTurns((all) => all.map((t) => (t.id === assistantTurn.id ? { ...t, streaming: false } : t)));
      } catch (err) {
        if (isAbortError(err)) {
          setTurns((all) => all.map((t) => (t.id === assistantTurn.id ? { ...t, streaming: false } : t)));
        } else {
          if (!isBrowserNetworkError(err)) {
            captureException(err, { source: "ask-ai" });
          }
          const friendly = sanitizeChatError(err);
          setTurns((all) =>
            all.map((t) =>
              t.id === assistantTurn.id ? { ...t, streaming: false, error: friendly } : t,
            ),
          );
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [attachments, busy, ensureSession],
  );

  const reset = useCallback(() => {
    void closeSession();
    setTurns([]);
    setAttachments([]);
  }, [closeSession]);

  return {
    turns,
    busy,
    sendMessage,
    reset,
    hasWorkspace: Boolean(orgId),
    attachments,
    uploadAttachment,
    removeAttachment,
  };
}
