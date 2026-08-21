"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import { api, type DisplayCurrency } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { VoicePagination } from "@/components/voice-agents/shared";
import {
  ChartContainer,
  ChartThemeGradient,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CurrencyToggle, UI_DEFAULT_CURRENCY, formatMoney } from "@/components/voice-agents/currency-toggle";
import { formatProviderModel } from "@/lib/voice/provider-brand";
import { flagForNumber } from "@/lib/country-flag";
import type { SessionUsage, SessionUsageMetric, StandaloneUsageRow, UsageCostSummary, UsageDailyRow } from "@/types";

const RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
] as const;

const METRIC_LABEL: Record<string, string> = {
  llm_tokens_prompt: "LLM prompt tokens",
  llm_tokens_completion: "LLM completion tokens",
  stt_audio_seconds: "Speech-to-text",
  tts_characters: "Text-to-speech (chars)",
  tts_audio_seconds: "Text-to-speech (audio)",
  phone_number_purchase: "Phone number purchased",
  phone_number_rent: "Monthly rent",
  infra_cost: "Infra cost",
};

const SOURCE_LABEL: Record<string, string> = {
  tts_studio: "Voice Library TTS",
  phone_number: "Phone numbers",
  other: "Other",
};

const SOURCE_CHIP: Record<string, { label: string; variant: "info" | "violet" | "secondary" | "success" }> = {
  tts_studio: { label: "Voice Library TTS", variant: "violet" },
  phone_number: { label: "Phone numbers", variant: "info" },
  other: { label: "Other", variant: "secondary" },
};

const METRIC_CHIP: Record<string, { label: string; variant: "success" | "violet" | "info" | "secondary" }> = {
  phone_number_purchase: { label: "Phone number purchased", variant: "success" },
  phone_number_rent: { label: "Monthly rent", variant: "violet" },
};

const chartConfig: ChartConfig = {
  cost: { label: "Cost", color: "var(--chart-1)" },
};

const PAGE_SIZE = 10;

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const VIEWER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function formatLocalWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 8);
}

const CHANNEL_META: Record<string, { label: string; variant: "info" | "violet" | "secondary" }> = {
  web: { label: "Web", variant: "info" },
  outbound: { label: "Outbound", variant: "violet" },
  inbound: { label: "Inbound", variant: "info" },
  incoming: { label: "Inbound", variant: "info" },
};

function ChannelBadge({ channel }: { channel: string | null | undefined }) {
  const meta = (channel && CHANNEL_META[channel]) || CHANNEL_META.incoming;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function SourceChip({ source }: { source: string }) {
  const meta = SOURCE_CHIP[source];
  if (!meta) return <>{SOURCE_LABEL[source] ?? source}</>;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function MetricChip({ metric }: { metric: string }) {
  const meta = METRIC_CHIP[metric];
  if (!meta) return <>{METRIC_LABEL[metric] ?? metric}</>;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function ProviderModelCell({ row }: { row: StandaloneUsageRow }) {
  if (row.source === "phone_number" && row.model_name) {
    return (
      <Badge variant="outline" className="font-mono font-normal">
        <span aria-hidden>{flagForNumber(row.model_name)}</span>
        {row.model_name}
      </Badge>
    );
  }
  return <>{formatProviderModel(row.provider_name, row.model_name)}</>;
}

export default function UsagePage() {
  const { org } = useWorkspace();
  const [rangeId, setRangeId] = useState<(typeof RANGE_OPTIONS)[number]["id"]>("30d");
  const [currency, setCurrency] = useState<DisplayCurrency>(UI_DEFAULT_CURRENCY);
  const [costSummary, setCostSummary] = useState<UsageCostSummary | null>(null);
  const [daily, setDaily] = useState<UsageDailyRow[]>([]);
  const [sessions, setSessions] = useState<SessionUsage[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [standalone, setStandalone] = useState<StandaloneUsageRow[]>([]);
  const [standaloneTotal, setStandaloneTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [standalonePage, setStandalonePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<SessionUsage | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const range = useMemo(() => RANGE_OPTIONS.find((r) => r.id === rangeId) ?? RANGE_OPTIONS[1], [rangeId]);
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - range.days);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  }, [range.days]);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const [cost, dailyPage, sessionPage, extraPage] = await Promise.all([
        api.usageCostSummary(org.id, { startDate, endDate, currency }),
        api.dailyUsage(org.id, { startDate, endDate, limit: 90, offset: 0, currency }),
        api.listSessionUsage(org.id, {
          startDate,
          endDate,
          currency,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }),
        api.listStandaloneUsage(org.id, {
          startDate,
          endDate,
          currency,
          limit: PAGE_SIZE,
          offset: (standalonePage - 1) * PAGE_SIZE,
        }),
      ]);
      setCostSummary(cost);
      setDaily(dailyPage.items);
      setSessions(sessionPage.items);
      setSessionTotal(sessionPage.total);
      setStandalone(extraPage.items);
      setStandaloneTotal(extraPage.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, [org, startDate, endDate, page, standalonePage, currency]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
    setStandalonePage(1);
  }, [rangeId, currency]);

  useEffect(() => {
    if (!openSessionId) {
      setBreakdown(null);
      return;
    }
    let cancelled = false;
    setBreakdownLoading(true);
    api
      .getSessionUsage(openSessionId, { currency })
      .then((row) => {
        if (!cancelled) setBreakdown(row);
      })
      .catch(() => {
        if (!cancelled) setBreakdown(null);
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openSessionId, currency]);

  function refresh() {
    setRefreshKey((k) => k + 1);
    toast.message("Refreshing usage…");
  }

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of daily) {
      const cost = row.cost ?? (row.cost_minor_units ?? 0) / 100;
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + cost);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cost]) => ({ day: day.slice(5), cost: Number(cost.toFixed(4)) }));
  }, [daily]);

  const displayCost = costSummary?.cost ?? costSummary?.totals[0]?.cost ?? 0;

  return (
    <div className="voice-page voice-page-wide">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title">Usage</h1>
        <div className="flex items-center gap-2">
          <CurrencyToggle value={currency} onChange={setCurrency} disabled={loading} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Calendar className="size-4" />
                {range.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {RANGE_OPTIONS.map((r) => (
                <DropdownMenuItem key={r.id} onClick={() => setRangeId(r.id)}>
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Minutes Consumed"
          value={loading ? null : `${(costSummary?.minutes_consumed ?? 0).toFixed(1)} mins`}
        />
        <StatTile
          label="Usage Cost"
          value={loading ? null : formatMoney(displayCost, currency)}
        />
        <StatTile label="Call sessions" value={loading ? null : String(sessionTotal)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline">Cost by day</h2>
          <span className="text-caption">{currency}</span>
        </div>
        {loading ? (
          <Skeleton className="h-56 w-full rounded-xl" />
        ) : chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={chartData} barCategoryGap="18%">
              <defs>
                <ChartThemeGradient id="usage-cost-fill" />
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-caption" />
              <YAxis tickLine={false} axisLine={false} width={40} className="text-caption" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="cost" fill="url(#usage-cost-fill)" radius={[6, 6, 2, 2]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <UsageTable
        title="Call sessions"
        loading={loading}
        emptyTitle="No calls in this range"
        emptyCaption="Completed calls will show here with a clubbed cost. Click a row for the breakdown."
        page={page}
        total={sessionTotal}
        onPageChange={setPage}
      >
        <thead>
          <tr className="border-b border-border">
            <th className="text-caption px-5 py-2.5 text-left font-medium">Session</th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">
              When
              <span className="ml-1.5 font-normal text-muted-foreground">{VIEWER_TIMEZONE.replaceAll("_", " ")}</span>
            </th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">Channel</th>
            <th className="text-caption px-5 py-2.5 text-right font-medium">Duration</th>
            <th className="text-caption px-5 py-2.5 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((row) => (
            <tr
              key={row.session_id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
              onClick={() => setOpenSessionId(row.session_id)}
            >
              <td className="px-5 py-2.5 font-mono text-xs">{shortId(row.session_id)}</td>
              <td className="px-5 py-2.5 whitespace-nowrap">{formatLocalWhen(row.created_at)}</td>
              <td className="px-5 py-2.5">
                <ChannelBadge channel={row.channel} />
              </td>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums">{formatDuration(row.duration_seconds)}</td>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                {formatMoney(row.cost ?? 0, row.currency || currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </UsageTable>

      <UsageTable
        title="Other usage"
        loading={loading}
        emptyTitle="No other usage"
        emptyCaption="Voice Library TTS, phone number purchases, monthly rent, and similar charges that are not part of a call show up here."
        page={standalonePage}
        total={standaloneTotal}
        onPageChange={setStandalonePage}
      >
        <thead>
          <tr className="border-b border-border">
            <th className="text-caption px-5 py-2.5 text-left font-medium">Day</th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">Source</th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">Metric</th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">Provider / Model</th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">Purchased</th>
            <th className="text-caption px-5 py-2.5 text-left font-medium">Next renewal</th>
            <th className="text-caption px-5 py-2.5 text-right font-medium">Quantity</th>
            <th className="text-caption px-5 py-2.5 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {standalone.map((row) => (
            <tr
              key={`${row.day}-${row.source}-${row.metric_type}-${row.provider_name}-${row.model_name}`}
              className="border-b border-border last:border-0"
            >
              <td className="px-5 py-2.5 text-left whitespace-nowrap">{row.day}</td>
              <td className="px-5 py-2.5 text-left">
                <SourceChip source={row.source} />
              </td>
              <td className="px-5 py-2.5 text-left">
                <MetricChip metric={row.metric_type} />
              </td>
              <td className="px-5 py-2.5 text-left text-muted-foreground">
                <ProviderModelCell row={row} />
              </td>
              <td className="px-5 py-2.5 text-left whitespace-nowrap text-muted-foreground">
                {row.source === "phone_number" ? row.purchase_date || "—" : "—"}
              </td>
              <td className="px-5 py-2.5 text-left whitespace-nowrap text-muted-foreground">
                {row.source === "phone_number" ? row.next_renewal_date || "—" : "—"}
              </td>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                {row.total_quantity.toLocaleString()}
              </td>
              <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                {formatMoney(row.cost, row.currency || currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </UsageTable>

      <Sheet open={openSessionId != null} onOpenChange={(open) => !open && setOpenSessionId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Call breakdown</SheetTitle>
            <SheetDescription>
              {openSessionId ? shortId(openSessionId) : ""} · {formatMoney(breakdown?.cost ?? 0, currency)}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {breakdownLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : !breakdown ? (
              <p className="text-caption">No line items for this call.</p>
            ) : (
              <>
                <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-caption text-muted-foreground">With agent</dt>
                    <dd className="font-mono tabular-nums">
                      {breakdown.transfer_duration_seconds && breakdown.transfer_duration_seconds > 0
                        ? formatDuration(breakdown.agent_duration_seconds)
                        : formatDuration(breakdown.duration_seconds)}
                    </dd>
                  </div>
                  {breakdown.transfer_duration_seconds != null && breakdown.transfer_duration_seconds > 0 ? (
                    <div>
                      <dt className="text-caption text-muted-foreground">After transfer</dt>
                      <dd className="font-mono tabular-nums">{formatDuration(breakdown.transfer_duration_seconds)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-caption text-muted-foreground">Total</dt>
                    <dd className="font-mono tabular-nums">{formatDuration(breakdown.duration_seconds)}</dd>
                  </div>
                </dl>
                {breakdown.metrics.length === 0 ? (
                  <p className="text-caption">No line items for this call.</p>
                ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="text-caption py-2 pr-3 font-medium">Metric</th>
                    <th className="text-caption py-2 pr-3 font-medium">Provider</th>
                    <th className="text-caption py-2 text-right font-medium">Qty</th>
                    <th className="text-caption py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.metrics.map((m: SessionUsageMetric) => (
                    <tr key={`${m.metric_type}-${m.provider_name}-${m.model_name}`} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3">{METRIC_LABEL[m.metric_type] ?? m.metric_type}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {formatProviderModel(m.provider_name, m.model_name)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {m.total_quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatMoney(m.cost ?? 0, m.currency || currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UsageTable({
  title,
  loading,
  emptyTitle,
  emptyCaption,
  page,
  total,
  onPageChange,
  children,
}: {
  title: string;
  loading: boolean;
  emptyTitle: string;
  emptyCaption: string;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}) {
  const empty = !loading && total === 0;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card shadow-elevated">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-headline">{title}</h2>
      </div>
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : empty ? (
        <div className="p-8 text-center">
          <p className="text-headline">{emptyTitle}</p>
          <p className="text-caption mt-1">{emptyCaption}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">{children}</table>
          </div>
          <div className="px-5 py-3">
            <VoicePagination
              page={page}
              perPage={PAGE_SIZE}
              total={total}
              onPageChange={onPageChange}
              onPerPageChange={() => {}}
              perPageOptions={[PAGE_SIZE]}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, caption }: { label: string; value: string | null; caption?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elevated">
      <p className="text-caption">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-24 rounded-md" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      )}
      {caption && <p className="text-caption mt-1 truncate">{caption}</p>}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
      <div className="flex h-10 items-end gap-1.5 opacity-40">
        {[40, 70, 30, 55].map((h, i) => (
          <span key={i} className="w-3 rounded-t-sm bg-muted-foreground" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="text-headline">No usage data</p>
      <p className="text-caption max-w-xs">No calls have consumed usage in the selected date range.</p>
    </div>
  );
}
