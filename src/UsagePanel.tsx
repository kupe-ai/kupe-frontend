import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusChip } from "@/components/ui/status-chip";
import { api } from "@/lib/api";
import type { SessionUsage, UsageDailyRow, UsageSummaryRow } from "@/types";

const PAGE_SIZE = 10;

type Props = { orgId: string };

export function UsagePanel({ orgId }: Props) {
  const [sessions, setSessions] = useState<SessionUsage[]>([]);
  const [summary, setSummary] = useState<UsageSummaryRow[]>([]);
  const [daily, setDaily] = useState<UsageDailyRow[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [summaryOffset, setSummaryOffset] = useState(0);
  const [dailyOffset, setDailyOffset] = useState(0);
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

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    (async () => {
      try {
        const page = await api.dailyUsage(orgId, {
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          limit: PAGE_SIZE,
          offset: dailyOffset,
        });
        if (!cancelled) {
          setDaily(page.items);
          setDailyTotal(page.total);
        }
      } catch {
        // daily usage is secondary, same as summary
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, dailyOffset]);

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
                {s.status && <StatusChip status={s.status} />}
                {s.transport && <Badge variant="outline">{s.transport}</Badge>}
                {s.duration_seconds != null && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(s.duration_seconds)}s
                  </span>
                )}
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
                      {(m.cache_read_input_tokens || m.reasoning_tokens || m.input_audio_tokens) && (
                        <div className="text-[10px] text-muted-foreground">
                          {m.cache_read_input_tokens ? `${m.cache_read_input_tokens} cached` : ""}
                          {m.reasoning_tokens ? ` · ${m.reasoning_tokens} reasoning` : ""}
                          {m.input_audio_tokens ? ` · ${m.input_audio_tokens} audio-in` : ""}
                          {m.output_audio_tokens ? ` · ${m.output_audio_tokens} audio-out` : ""}
                        </div>
                      )}
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

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Daily usage</CardTitle>
          <CardDescription>Usage rolled up by day, for billing-period views.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {daily.length === 0 && <p className="text-sm text-muted-foreground">No daily usage yet.</p>}
          {daily.map((d) => (
            <div key={`${d.day}-${d.metric_type}-${d.provider_name}-${d.model_name}-${d.transport}`}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {d.day} — {d.provider_name} / {d.model_name} ({d.metric_type}, {d.transport})
                </span>
                <span className="font-mono">{d.total_quantity.toLocaleString()}</span>
              </div>
              <Separator className="mt-2" />
            </div>
          ))}
          <PaginationControls
            total={dailyTotal}
            limit={PAGE_SIZE}
            offset={dailyOffset}
            onPageChange={setDailyOffset}
          />
        </CardContent>
      </Card>
    </div>
  );
}
