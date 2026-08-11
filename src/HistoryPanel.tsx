import { useEffect, useRef, useState } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { api } from "@/lib/api";
import type { AnalysisResult, Organization, SessionInfo, TranscriptInfo } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PAGE_SIZE = 10;

function statusBadge(status: string) {
  if (status === "active" || status === "completed" || status === "ready" || status === "ended")
    return "success" as const;
  if (status === "failed" || status === "error") return "destructive" as const;
  if (status === "pending" || status === "processing" || status === "starting") return "warning" as const;
  return "secondary" as const;
}

export default function HistoryPanel({ org, refreshKey }: { org: Organization; refreshKey: number }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedIdRef = useRef<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptInfo | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);

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
    setUsageLabel(null);
    const [t, r, u] = await Promise.allSettled([
      api.getTranscript(sessionId),
      api.getAnalysisResults(sessionId),
      api.getSessionUsage(sessionId),
    ]);
    if (expandedIdRef.current !== sessionId) return;
    setTranscript(t.status === "fulfilled" ? t.value : null);
    setResults(r.status === "fulfilled" ? r.value.items : []);
    if (u.status === "fulfilled") {
      setUsageLabel(
        `${u.value.total_tokens.toLocaleString()} tokens (prompt ${u.value.prompt_tokens.toLocaleString()} / completion ${u.value.completion_tokens.toLocaleString()})`,
      );
    } else {
      setUsageLabel("No usage recorded");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.listSessions(org.id, { limit: PAGE_SIZE, offset });
        if (cancelled) return;
        setSessions(page.items);
        setTotal(page.total);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org.id, refreshKey, offset]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>Sessions for this organization.</CardDescription>
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
        {sessions.map((s) => (
          <div key={s.session_id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadge(s.status)}>{s.status}</Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                {s.llm_id.slice(0, 8)} / {s.stt_id.slice(0, 8)} / {s.tts_id.slice(0, 8)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => void toggleExpand(s.session_id)}
              >
                {expandedId === s.session_id ? "Hide details" : "Show details"}
              </Button>
            </div>
            {expandedId === s.session_id && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div>
                  <div className="mb-1 text-sm font-medium">Usage</div>
                  <p className="text-sm text-muted-foreground">{usageLabel ?? "Loading…"}</p>
                </div>
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
        ))}
        <PaginationControls total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
      </CardContent>
    </Card>
  );
}
