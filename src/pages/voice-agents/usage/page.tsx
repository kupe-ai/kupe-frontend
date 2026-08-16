"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/context/workspace-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import type { UsageCostSummary, UsageDailyRow } from "@/types";

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
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹" };

function formatCost(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency + " ";
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const chartConfig: ChartConfig = {
  cost: { label: "Cost", color: "var(--chart-1)" },
};

const PAGE_SIZE = 10;

export default function UsagePage() {
  const { org } = useWorkspace();
  const [rangeId, setRangeId] = useState<(typeof RANGE_OPTIONS)[number]["id"]>("30d");
  const [costSummary, setCostSummary] = useState<UsageCostSummary | null>(null);
  const [daily, setDaily] = useState<UsageDailyRow[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
      const [cost, dailyPage] = await Promise.all([
        api.usageCostSummary(org.id, { startDate, endDate }),
        api.dailyUsage(org.id, { startDate, endDate, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
      ]);
      setCostSummary(cost);
      setDaily(dailyPage.items);
      setDailyTotal(dailyPage.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, [org, startDate, endDate, page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [rangeId]);

  function refresh() {
    setRefreshKey((k) => k + 1);
    toast.message("Refreshing usage…");
  }

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of daily) {
      const cost = (row.cost_minor_units ?? 0) / 100;
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + cost);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cost]) => ({ day: day.slice(5), cost: Number(cost.toFixed(4)) }));
  }, [daily]);

  const primaryCurrency = costSummary?.totals[0]?.currency ?? "USD";
  const primaryCost = costSummary?.totals.find((t) => t.currency === primaryCurrency)?.cost ?? 0;
  const otherTotals = costSummary?.totals.filter((t) => t.currency !== primaryCurrency) ?? [];

  return (
    <div className="voice-page voice-page-wide">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title">Usage</h1>
        <div className="flex items-center gap-2">
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
          value={loading ? null : formatCost(primaryCost, primaryCurrency)}
          caption={
            otherTotals.length > 0
              ? otherTotals.map((t) => `+ ${formatCost(t.cost, t.currency)}`).join(", ")
              : undefined
          }
        />
        <StatTile label="Telephony Cost" value={loading ? null : "—"} caption="Not tracked yet" />
        <StatTile label="Phone Numbers Purchased" value={loading ? null : "—"} caption="Not tracked yet" />
        <StatTile label="Phone Numbers Cost" value={loading ? null : "—"} caption="Not tracked yet" />
        <StatTile
          label="Providers Billed"
          value={loading ? null : String(costSummary?.totals.length ?? 0)}
          caption={costSummary?.totals.map((t) => t.currency).join(" · ") || undefined}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline">Cost by day</h2>
          <span className="text-caption">{primaryCurrency}</span>
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

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-headline">Daily breakdown</h2>
        </div>
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : daily.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-headline">No usage in this range</p>
            <p className="text-caption mt-1">Calls and agent activity will show up here as they happen.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="text-caption px-5 py-2.5 font-medium">Day</th>
                    <th className="text-caption px-5 py-2.5 font-medium">Metric</th>
                    <th className="text-caption px-5 py-2.5 font-medium">Provider / Model</th>
                    <th className="text-caption px-5 py-2.5 text-right font-medium">Quantity</th>
                    <th className="text-caption px-5 py-2.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((row) => (
                    <tr
                      key={`${row.day}-${row.metric_type}-${row.provider_name}-${row.model_name}-${row.transport}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-5 py-2.5 whitespace-nowrap">{row.day}</td>
                      <td className="px-5 py-2.5">{METRIC_LABEL[row.metric_type] ?? row.metric_type}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">
                        {row.provider_name} / {row.model_name}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                        {row.total_quantity.toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                        {row.currency ? formatCost((row.cost_minor_units ?? 0) / 100, row.currency) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3">
              <VoicePagination
                page={page}
                perPage={PAGE_SIZE}
                total={dailyTotal}
                onPageChange={setPage}
                onPerPageChange={() => {}}
                perPageOptions={[PAGE_SIZE]}
              />
            </div>
          </>
        )}
      </div>
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
