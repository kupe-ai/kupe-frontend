import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { PageResponse, VoiceCall, VoiceCallTranscriptTurn } from "./types";

export interface WebCallResult {
  call_id: string;
  room_name: string;
  access_token: string;
  livekit_url: string;
}

export async function createWebCall(
  agentId: string,
  variables?: Record<string, string>,
): Promise<WebCallResult> {
  const { orgId, projectId } = requireScope();
  const session = await api.createSession({
    agent_id: agentId,
    org_id: orgId,
    project_id: projectId,
    channel: "web",
    ...(variables && Object.keys(variables).length > 0 ? { variables } : {}),
  });
  return {
    call_id: session.session_id,
    room_name: session.room_name ?? session.session_id,
    access_token: session.token ?? "",
    livekit_url: session.ws_url ?? "",
  };
}

function connectivityOf(status: string): string {
  if (status === "failed") return "failed";
  if (status === "ended" || status === "active") return "connected";
  return status || "starting";
}

function directionOf(channel: string): VoiceCall["direction"] {
  if (channel === "telephony") return "outbound";
  return "web";
}

function toVoiceCall(s: {
  session_id: string;
  channel: string;
  status: string;
  created_at: string;
  started_at?: string | null;
  ended_at: string | null;
  agent_id?: string | null;
  user_identifier?: string | null;
  ended_by?: string | null;
  failure_reason?: string | null;
  language?: string | null;
  message_count?: number;
  duration_seconds?: number | null;
  agent_duration_seconds?: number | null;
  transfer_duration_seconds?: number | null;
  avg_agent_latency_ms?: number | null;
  avg_user_latency_ms?: number | null;
  attempt_number?: number;
  goal_status?: string | null;
}): VoiceCall {
  const duration =
    s.duration_seconds != null
      ? Math.max(0, Math.round(s.duration_seconds))
      : s.ended_at
        ? Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at || s.created_at).getTime()) / 1000))
        : null;
  return {
    id: s.session_id,
    agent_id: s.agent_id ?? "",
    direction: directionOf(s.channel),
    channel: s.channel === "telephony" ? "pstn" : "web",
    status: s.status,
    connectivity: connectivityOf(s.status),
    failure_reason: s.failure_reason ?? null,
    ended_by: s.ended_by ?? null,
    started_at: s.started_at || s.created_at,
    ended_at: s.ended_at,
    duration_seconds: duration,
    agent_duration_seconds:
      s.agent_duration_seconds != null ? Math.max(0, Math.round(s.agent_duration_seconds)) : null,
    transfer_duration_seconds:
      s.transfer_duration_seconds != null ? Math.max(0, Math.round(s.transfer_duration_seconds)) : null,
    language: s.language ?? null,
    message_count: s.message_count ?? 0,
    avg_agent_latency_ms: s.avg_agent_latency_ms != null ? Math.round(s.avg_agent_latency_ms) : null,
    avg_user_latency_ms: s.avg_user_latency_ms != null ? Math.round(s.avg_user_latency_ms) : null,
    attempt_number: s.attempt_number ?? 1,
    user_identifier: s.user_identifier ?? null,
    goal_status: s.goal_status ?? null,
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

export type InteractionDetail = VoiceCall & {
  transcript: VoiceCallTranscriptTurn[];
  recording_url: string | null;
};

const _interactionCache = new Map<string, Promise<InteractionDetail>>();

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

async function loadInteraction(callId: string, seed?: VoiceCall): Promise<InteractionDetail> {
  const sessionP = seed
    ? Promise.resolve(seed)
    : api.getSession(callId).then(toVoiceCall).catch(() =>
        toVoiceCall({
          session_id: callId,
          channel: "web",
          status: "ended",
          created_at: new Date().toISOString(),
          ended_at: null,
        }),
      );

  const transcriptP = api
    .getTranscript(callId)
    .then((info) => toTranscriptTurns(info.turns, info.transcript))
    .catch(() => [] as VoiceCallTranscriptTurn[]);

  const recordingP = api
    .getRecording(callId)
    .then(async (rec) => {
      if (rec.status === "complete" && rec.id) {
        const play = await api.getPlaybackUrl(rec.id);
        return play.url;
      }
      return null;
    })
    .catch(() => null);

  const [base, transcript, recording_url] = await Promise.all([sessionP, transcriptP, recordingP]);
  return { ...base, transcript, recording_url };
}

export function prefetchInteraction(callId: string, seed?: VoiceCall): Promise<InteractionDetail> {
  let pending = _interactionCache.get(callId);
  if (!pending) {
    pending = loadInteraction(callId, seed).then((detail) => {
      // Teardown reports the transcript after hangup. Caching an empty
      // result from a hover/open that raced that POST would hide the real
      // conversation until a full reload.
      if (detail.transcript.length === 0) {
        _interactionCache.delete(callId);
      }
      return detail;
    });
    _interactionCache.set(callId, pending);
    pending.catch(() => _interactionCache.delete(callId));
  }
  return pending;
}

export function getInteraction(callId: string, seed?: VoiceCall): Promise<InteractionDetail> {
  return prefetchInteraction(callId, seed);
}
