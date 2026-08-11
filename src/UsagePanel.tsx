import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { SessionUsage, UsageSummaryRow } from "@/types";

const PAGE_SIZE = 10;

type Props = { orgId: string };

export function UsagePanel({ orgId }: Props) {
  const [sessions, setSessions] = useState<SessionUsage[]>([]);
  const [summary, setSummary] = useState<UsageSummaryRow[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [summaryOffset, setSummaryOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.listSessionUsage(orgId, { limit: PAGE_SIZE, offset: sessionOffset });
        if (!cancelled) {
          setSessions(page.items);
          setSessionTotal(page.total);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, sessionOffset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.usageSummary(orgId, { limit: PAGE_SIZE, offset: summaryOffset });
        if (!cancelled) {
          setSummary(page.items);
          setSummaryTotal(page.total);
        }
      } catch {
        // summary is secondary
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, summaryOffset]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Per-call usage</CardTitle>
          <CardDescription>Token and provider usage stored for each session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {sessions.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
          )}
          {sessions.map((s) => (
            <div key={s.session_id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{s.session_id.slice(0, 8)}…</span>
                {s.status && <Badge variant="secondary">{s.status}</Badge>}
                {s.created_at && (
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                )}
                <span className="ml-auto font-mono text-sm">
                  {s.total_tokens.toLocaleString()} tokens
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Prompt </span>
                  <span className="font-mono">{s.prompt_tokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completion </span>
                  <span className="font-mono">{s.completion_tokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">STT/TTS </span>
                  <span className="font-mono">
                    {s.metrics
                      .filter((m) => m.metric_type === "stt_audio_seconds" || m.metric_type === "tts_characters")
                      .reduce((acc, m) => acc + m.total_quantity, 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>
              {s.metrics.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {s.metrics.map((m) => (
                    <div
                      key={`${m.metric_type}-${m.provider_name}-${m.model_name}`}
                      className="flex justify-between gap-4 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {m.provider_name} / {m.model_name} ({m.metric_type})
                      </span>
                      <span className="font-mono">{m.total_quantity.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <PaginationControls
            total={sessionTotal}
            limit={PAGE_SIZE}
            offset={sessionOffset}
            onPageChange={setSessionOffset}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Org totals</CardTitle>
          <CardDescription>Aggregated provider metrics across all calls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.length === 0 && <p className="text-sm text-muted-foreground">No aggregates yet.</p>}
          {summary.map((u) => (
            <div key={`${u.metric_type}-${u.provider_name}-${u.model_name}`}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {u.provider_name} / {u.model_name} ({u.metric_type})
                </span>
                <span className="font-mono">{u.total_quantity.toLocaleString()}</span>
              </div>
              <Separator className="mt-2" />
            </div>
          ))}
          <PaginationControls
            total={summaryTotal}
            limit={PAGE_SIZE}
            offset={summaryOffset}
            onPageChange={setSummaryOffset}
          />
        </CardContent>
      </Card>
    </div>
  );
}
