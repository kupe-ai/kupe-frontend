import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { supabase } from "./lib/supabase";
import type { Organization, UsageSummaryRow } from "./types";

type SessionRow = {
  id: string;
  status: string;
  transport: string;
  llm_id: string;
  stt_id: string;
  tts_id: string;
  created_at: string;
  ended_at: string | null;
};

type RecordingRow = {
  session_id: string;
  status: string;
  duration_seconds: number | null;
};

/** Dashboard-style reads. Sessions/recordings are read directly from
 * Supabase (RLS-protected by the signed-in user's own JWT) since there's no
 * "list sessions" CRUD endpoint -- exactly the hybrid pattern the backend
 * was designed around: direct reads for pure dashboard data, CRUD only for
 * things with side effects or server-side aggregation (usage).
 */
export default function HistoryPanel({ org, refreshKey }: { org: Organization; refreshKey: number }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [recordings, setRecordings] = useState<Record<string, RecordingRow>>({});
  const [usage, setUsage] = useState<UsageSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: sessionRows, error: sessionsErr }, usageRows] = await Promise.all([
          supabase
            .from("sessions")
            .select("id, status, transport, llm_id, stt_id, tts_id, created_at, ended_at")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false })
            .limit(10),
          api.usageSummary(org.id).catch(() => []),
        ]);
        if (cancelled) return;
        if (sessionsErr) throw sessionsErr;
        setSessions(sessionRows ?? []);
        setUsage(usageRows);

        const { data: recordingRows } = await supabase
          .from("recordings")
          .select("session_id, status, duration_seconds")
          .eq("org_id", org.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (cancelled) return;
        const bySession: Record<string, RecordingRow> = {};
        for (const r of recordingRows ?? []) bySession[r.session_id] = r;
        setRecordings(bySession);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org.id, refreshKey]);

  return (
    <div className="history-panel">
      <h2>Recent sessions</h2>
      {error && <p className="error">{error}</p>}
      {sessions.length === 0 && !error && <p className="transcript-empty">No sessions yet.</p>}
      {sessions.map((s) => {
        const recording = recordings[s.id];
        return (
          <div key={s.id} className="history-row">
            <span className={`status-badge status-${s.status}`}>{s.status}</span>
            <span className="room-name">{new Date(s.created_at).toLocaleString()}</span>
            <span className="history-providers">
              {s.llm_id.slice(0, 8)} / {s.stt_id.slice(0, 8)} / {s.tts_id.slice(0, 8)}
            </span>
            {recording && <span className="history-recording">recording: {recording.status}</span>}
          </div>
        );
      })}

      {usage.length > 0 && (
        <>
          <h2>Usage</h2>
          {usage.map((u) => (
            <div key={`${u.metric_type}-${u.provider_name}-${u.model_name}`} className="latency-row">
              <span>
                {u.provider_name} / {u.model_name} ({u.metric_type})
              </span>
              <span>{u.total_quantity}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
