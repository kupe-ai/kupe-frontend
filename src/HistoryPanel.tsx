import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { AnalysisResult, Organization, TranscriptInfo, UsageSummaryRow } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

function statusBadge(status: string) {
  if (status === "active" || status === "completed" || status === "ready") return "success" as const;
  if (status === "failed" || status === "error") return "destructive" as const;
  if (status === "pending" || status === "processing") return "warning" as const;
  return "secondary" as const;
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedIdRef = useRef<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptInfo | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);

  async function toggleExpand(sessionId: string) {
    if (expandedIdRef.current === sessionId) {
      expandedIdRef.current = null;
      setExpandedId(null);
      return;
    }
    expandedIdRef.current = sessionId;
    setExpandedId(sessionId);
    setTranscript(null);
    setResults([]);
    const [t, r] = await Promise.allSettled([api.getTranscript(sessionId), api.getAnalysisResults(sessionId)]);
    if (expandedIdRef.current !== sessionId) return;
    setTranscript(t.status === "fulfilled" ? t.value : null);
    setResults(r.status === "fulfilled" ? r.value : []);
  }

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>Last 10 sessions for this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {sessions.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          )}
          {sessions.map((s) => {
            const recording = recordings[s.id];
            return (
              <div key={s.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadge(s.status)}>{s.status}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.llm_id.slice(0, 8)} / {s.stt_id.slice(0, 8)} / {s.tts_id.slice(0, 8)}
                  </span>
                  {recording && <Badge variant="outline">recording: {recording.status}</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => void toggleExpand(s.id)}
                  >
                    {expandedId === s.id ? "Hide details" : "Show details"}
                  </Button>
                </div>
                {expandedId === s.id && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div>
                      <div className="mb-1 text-sm font-medium">Transcript</div>
                      <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
                        {transcript?.transcript ?? "No transcript captured."}
                      </pre>
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-medium">Post-call analysis</div>
                      {results.length === 0 && (
                        <p className="text-sm text-muted-foreground">No analyses attached or still pending.</p>
                      )}
                      {results.map((r) => (
                        <div key={r.post_call_analysis_id} className="mb-2 rounded-md border border-border p-2">
                          <div className="text-sm font-medium">
                            {r.name} — {r.status}
                          </div>
                          {r.result && (
                            <pre className="mt-1 overflow-auto font-mono text-xs whitespace-pre-wrap">
                              {JSON.stringify(r.result, null, 2)}
                            </pre>
                          )}
                          {r.error && <p className="mt-1 text-sm text-destructive">{r.error}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {usage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Aggregated provider usage for this org.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {usage.map((u) => (
              <div key={`${u.metric_type}-${u.provider_name}-${u.model_name}`}>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {u.provider_name} / {u.model_name} ({u.metric_type})
                  </span>
                  <span className="font-mono">{u.total_quantity}</span>
                </div>
                <Separator className="mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
