import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { PageResponse, VoiceCall, VoiceCallTranscriptTurn } from "./types";

export interface WebCallResult {
  call_id: string;
  room_name: string;
  access_token: string;
  livekit_url: string;
}

export async function createWebCall(agentId: string, _userIdentifier?: string): Promise<WebCallResult> {
  const { orgId, projectId } = requireScope();
  const session = await api.createSession({
    agent_id: agentId,
    org_id: orgId,
    project_id: projectId,
    channel: "web",
  });
  return {
    call_id: session.session_id,
    room_name: session.room_name ?? session.session_id,
    access_token: session.token ?? "",
    livekit_url: session.ws_url ?? "",
  };
}

function toVoiceCall(s: {
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  ended_at: string | null;
}): VoiceCall {
  return {
    id: s.session_id,
    agent_id: "",
    direction: s.channel === "telephony" ? "outbound" : "web",
    channel: s.channel === "telephony" ? "pstn" : "web",
    status: s.status,
    connectivity: s.status === "ended" || s.status === "active" ? "connected" : s.status,
    failure_reason: null,
    ended_by: null,
    started_at: s.created_at,
    ended_at: s.ended_at,
    duration_seconds: null,
    language: null,
    message_count: 0,
    avg_agent_latency_ms: null,
    avg_user_latency_ms: null,
    attempt_number: 1,
    user_identifier: null,
    goal_status: null,
    variables: {},
  };
}

export async function listInteractions(
  params: { agent_id?: string; campaign_id?: string; connectivity?: string; page?: number; page_size?: number } = {},
): Promise<PageResponse<VoiceCall>> {
  const { orgId } = requireScope();
  const pageSize = params.page_size ?? 20;
  const page = params.page ?? 1;
  const res = await api.listSessions(orgId, { limit: 100, offset: 0 });
  let items = res.items.map(toVoiceCall);
  if (params.connectivity === "connected") {
    items = items.filter((c) => c.connectivity === "connected");
  }
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    page_size: pageSize,
    total: items.length,
    has_more: start + slice.length < items.length,
  };
}

function toTranscriptTurns(turns: unknown, fallbackText?: string): VoiceCallTranscriptTurn[] {
  const list = Array.isArray(turns) ? turns : [];
  const mapped = list
    .map((t, i) => {
      if (!t || typeof t !== "object") return null;
      const row = t as { role?: string; text?: string };
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) return null;
      const role: VoiceCallTranscriptTurn["role"] =
        row.role === "assistant" || row.role === "agent" ? "agent" : row.role === "user" ? "user" : "system";
      return { role, text, ts_offset_ms: 0, ordinal: i };
    })
    .filter((t): t is VoiceCallTranscriptTurn => t != null);
  if (mapped.length > 0) return mapped;
  if (!fallbackText?.trim()) return [];
  return fallbackText
    .split("\n")
    .map((line, i) => {
      const match = line.match(/^(user|assistant|agent|system)\s*:\s*(.*)$/i);
      if (!match) return null;
      const roleRaw = match[1].toLowerCase();
      const role: VoiceCallTranscriptTurn["role"] =
        roleRaw === "assistant" || roleRaw === "agent" ? "agent" : roleRaw === "user" ? "user" : "system";
      const text = match[2].trim();
      if (!text) return null;
      return { role, text, ts_offset_ms: 0, ordinal: i };
    })
    .filter((t): t is VoiceCallTranscriptTurn => t != null);
}

export async function getInteraction(callId: string) {
  const { orgId } = requireScope();
  const sessions = await api.listSessions(orgId, { limit: 100 });
  const session = sessions.items.find((s) => s.session_id === callId);
  const base = session
    ? toVoiceCall(session)
    : toVoiceCall({
        session_id: callId,
        channel: "web",
        status: "ended",
        created_at: new Date().toISOString(),
        ended_at: null,
      });
  let transcript: VoiceCallTranscriptTurn[] = [];
  try {
    const info = await api.getTranscript(callId);
    transcript = toTranscriptTurns(info.turns, info.transcript);
  } catch {
    transcript = [];
  }
  let recording_url: string | null = null;
  try {
    const rec = await api.getRecording(callId);
    if (rec.status === "complete" && rec.id) {
      const play = await api.getPlaybackUrl(rec.id);
      recording_url = play.url;
    }
  } catch {
    recording_url = null;
  }
  return { ...base, transcript, recording_url };
}
