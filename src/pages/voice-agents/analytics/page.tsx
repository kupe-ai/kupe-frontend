"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState, AsciiIcon } from "@/components/voice-agents/ascii-icons";
import { CallLogDetailDialog } from "@/components/voice-agents/call-log-detail-dialog";
import { PipelineFunnel } from "@/components/voice-agents/pipeline-funnel";
import { VoicePagination } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartThemeGradient,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  getAnalyticsConnectivity,
  getAnalyticsEngagement,
  getAnalyticsGoals,
  getAnalyticsGroupBy,
  getAnalyticsOverview,
} from "@/lib/api/voice/analytics";
import { listInteractions } from "@/lib/api/voice/calls";
import { uploadEvaluationCriteria } from "@/lib/api/voice/evaluation";
import type { VoiceCall } from "@/lib/api/voice/types";

const ANALYTICS_TABS = [
  { id: "overview", label: "Overview" },
  { id: "connectivity", label: "Connectivity" },
  { id: "engagement", label: "Engagement" },
  { id: "tools", label: "Tools" },
  { id: "goals", label: "Goals" },
  { id: "groupby", label: "Group by" },
  { id: "calllogs", label: "Call Logs" },
] as const;
type AnalyticsTab = (typeof ANALYTICS_TABS)[number]["id"];

const barConfig = {
  rate: { label: "Calls", color: "var(--chart-2)" },
} satisfies ChartConfig;

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
  toast.message("Copied");
}

export default function VoiceAgentsAnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [logFilter, setLogFilter] = useState<"all" | "connected">("all");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAnalyticsOverview>> | null>(null);
  const [connectivity, setConnectivity] = useState<Awaited<ReturnType<typeof getAnalyticsConnectivity>> | null>(null);
  const [engagement, setEngagement] = useState<Awaited<ReturnType<typeof getAnalyticsEngagement>> | null>(null);
  const [goals, setGoals] = useState<Awaited<ReturnType<typeof getAnalyticsGoals>> | null>(null);
  const [groupBy, setGroupBy] = useState<Array<Record<string, number | string>>>([]);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [callsTotal, setCallsTotal] = useState(0);
  const [callsLoading, setCallsLoading] = useState(false);

  useEffect(() => {
    document.title = "Agent analytics · Voice Agents · Kupe";
  }, []);

  const refreshTabData = useCallback(() => {
    if (tab === "overview") getAnalyticsOverview().then(setOverview).catch(() => setOverview(null));
    if (tab === "connectivity") {
      getAnalyticsOverview().then(setOverview).catch(() => setOverview(null));
      getAnalyticsConnectivity().then(setConnectivity).catch(() => setConnectivity(null));
    }
    if (tab === "engagement") getAnalyticsEngagement().then(setEngagement).catch(() => setEngagement(null));
    if (tab === "goals") getAnalyticsGoals().then(setGoals).catch(() => setGoals(null));
    if (tab === "groupby") getAnalyticsGroupBy("campaign").then(setGroupBy).catch(() => setGroupBy([]));
    if (tab === "calllogs") {
      setCallsLoading(true);
      listInteractions({
        connectivity: logFilter === "connected" ? "connected" : undefined,
        page,
        page_size: perPage,
      })
        .then((res) => {
          setCalls(res.items);
          setCallsTotal(res.total);
        })
        .catch(() => {
          setCalls([]);
          setCallsTotal(0);
        })
        .finally(() => setCallsLoading(false));
    }
  }, [tab, logFilter, page, perPage]);

  useEffect(() => {
    refreshTabData();
  }, [refreshTabData]);

  return (
    <div className="voice-page voice-page-wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title">Analytics</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setEvalOpen(true)}>
            <Upload className="size-3.5" />
            Upload evaluation criteria
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => refreshTabData()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => toast.message("Export coming soon")}>
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {ANALYTICS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={cn(
                "pressable border-b-2 px-2.5 py-2 text-sm",
                tab === t.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 pb-10">
        {tab === "overview" ? <OverviewTab data={overview} /> : null}
        {tab === "connectivity" ? <ConnectivityTab overview={overview} data={connectivity} /> : null}
        {tab === "engagement" ? <EngagementTab data={engagement} /> : null}
        {tab === "tools" ? <ToolsTab /> : null}
        {tab === "goals" ? <GoalsTab data={goals} onUpload={() => setEvalOpen(true)} /> : null}
        {tab === "groupby" ? <GroupByTab rows={groupBy} /> : null}
        {tab === "calllogs" ? (
          <CallLogsTab
            calls={calls}
            total={callsTotal}
            loading={callsLoading}
            page={page}
            perPage={perPage}
            filter={logFilter}
            onFilter={(f) => {
              setLogFilter(f);
              setPage(1);
            }}
            onPage={setPage}
            onPerPage={setPerPage}
            onOpen={(call) => {
              setSelectedCallId(call.id);
              setDetailOpen(true);
            }}
          />
        ) : null}
      </div>

      <CallLogDetailDialog callId={selectedCallId} open={detailOpen} onOpenChange={setDetailOpen} />
      <EvaluationCriteriaDialog open={evalOpen} onOpenChange={setEvalOpen} />
    </div>
  );
}

function KpiRow({ items }: { items: { id: string; label: string; value: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((k) => (
        <div key={k.id} className="rounded-xl border border-border bg-card px-3 py-3 text-left">
          <p className="text-xs text-muted-foreground">{k.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
        </div>
      ))}
    </div>
  );
}

function VolumeChart({ byHour }: { byHour: Record<string, number> }) {
  const data = useMemo(
    () =>
      Object.entries(byHour)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, count]) => ({ hour: `${hour}:00`, rate: count })),
    [byHour],
  );

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-semibold">Call volume by hour of day</p>
      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No calls in this period</div>
      ) : (
        <ChartContainer config={barConfig} className="h-[220px] w-full">
          <BarChart data={data}>
            <defs>
              <ChartThemeGradient id="analytics-volume-fill" />
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="rate" fill="url(#analytics-volume-fill)" radius={[6, 6, 2, 2]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: Awaited<ReturnType<typeof getAnalyticsOverview>> | null }) {
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
        <div className="h-[220px] animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    );
  }

  const items = [
    { id: "total", label: "Total calls", value: String(data.total_calls) },
    { id: "connected", label: "Connected", value: String(data.connected_calls) },
    { id: "rate", label: "Connectivity rate", value: `${(data.connectivity_rate * 100).toFixed(1)}%` },
    { id: "duration", label: "Avg duration", value: `${data.avg_duration_seconds.toFixed(0)}s` },
  ];

  return (
    <div>
      <KpiRow items={items} />
      <VolumeChart byHour={data.volume_by_hour} />
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Top failure reasons</p>
        {Object.keys(data.failure_reasons).length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">No failures in this period</div>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(data.failure_reasons).map(([reason, count]) => (
              <li key={reason} className="flex justify-between">
                <span className="text-muted-foreground">{reason}</span>
                <span className="tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConnectivityTab({
  overview,
  data,
}: {
  overview: Awaited<ReturnType<typeof getAnalyticsOverview>> | null;
  data: Awaited<ReturnType<typeof getAnalyticsConnectivity>> | null;
}) {
  if (!overview || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </div>
    );
  }

  const items = [
    { id: "connected", label: "Connected", value: String(overview.connected_calls) },
    { id: "rate", label: "Connectivity rate", value: `${(overview.connectivity_rate * 100).toFixed(1)}%` },
  ];

  return (
    <div>
      <KpiRow items={items} />
      <VolumeChart byHour={overview.volume_by_hour} />
      <TableCard title="Phone number health" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                {["Phone number", "Connected", "Failed", "No answer", "Busy"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.phone_number_health).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No phone numbers with call activity yet.
                  </td>
                </tr>
              ) : (
                Object.entries(data.phone_number_health).map(([number, counts]) => (
                  <tr key={number} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs">{number}</td>
                    <td className="px-3 py-2.5 tabular-nums">{counts.connected ?? 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{counts.failed ?? 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{counts.no_answer ?? 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{counts.busy ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
    </div>
  );
}

function EngagementTab({ data }: { data: Awaited<ReturnType<typeof getAnalyticsEngagement>> | null }) {
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const totalLangCalls = Object.values(data.by_language).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Full Pipeline Funnel</p>
        <p className="text-xs text-muted-foreground">Step-wise conversion from attempted calls through engaged conversations.</p>
        <PipelineFunnel
          stages={[
            { label: "Attempted", value: data.funnel.attempted },
            { label: "Connected", value: data.funnel.connected },
            { label: "Engaged", value: data.funnel.engaged },
          ]}
        />
      </div>
      <TableCard title="Engagement by language" className="mt-4">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              {["Language", "Calls", "% of interactions"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.by_language).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                  No calls in this period.
                </td>
              </tr>
            ) : (
              Object.entries(data.by_language).map(([language, count]) => (
                <tr key={language} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 font-medium">{language}</td>
                  <td className="px-3 py-2.5 tabular-nums">{count}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {totalLangCalls ? `${((count / totalLangCalls) * 100).toFixed(0)}%` : "0%"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function ToolsTab() {
  return (
    <div>
      <div className="mt-4 rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-semibold">Tools called</p>
        <p className="text-xs text-muted-foreground">
          Every custom tool invoked in the selected window — click a row for affected interactions.
        </p>
        <AsciiEmptyState
          kind="chart"
          tone="slate"
          title="No tool-call metrics yet"
          description="Per-tool latency/error breakdowns land in a later release — tool calls themselves already run for real during calls."
          className="py-10"
        />
      </div>
    </div>
  );
}

function GoalsTab({ data, onUpload }: { data: Awaited<ReturnType<typeof getAnalyticsGoals>> | null; onUpload: () => void }) {
  if (data === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const hasGoalData = Object.values(data.goal_status).some((v) => v > 0 && Object.keys(data.goal_status).length > 1);

  if (!hasGoalData) {
    return (
      <AsciiEmptyState
        kind="chart"
        tone="slate"
        title="No goal-configured calls yet"
        description="Set a Call goal in an agent's Variables tab, then calls will be scored against it here."
        className="min-h-[50vh]"
        actions={
          <Button className="rounded-full" onClick={onUpload}>
            <Upload className="size-3.5" />
            Upload evaluation criteria
          </Button>
        }
      />
    );
  }

  return (
    <TableCard title="Goal status">
      <ul className="divide-y divide-border">
        {Object.entries(data!.goal_status).map(([status, count]) => (
          <li key={status} className="flex items-center justify-between px-4 py-3 text-sm">
            <StatusChip status={status} />
            <span className="tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </TableCard>
  );
}

function GroupByTab({ rows }: { rows: Array<Record<string, number | string>> }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="outline" size="sm" className="h-8 rounded-full">
          Campaign
          <ChevronDown className="size-3.5" />
        </Button>
      </div>
      <TableCard title="">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Campaign</th>
                <th className="px-3 py-2 font-medium">Connected</th>
                <th className="px-3 py-2 font-medium">Failed</th>
                <th className="px-3 py-2 font-medium">No answer</th>
                <th className="px-3 py-2 font-medium">Busy</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No campaign activity yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={String(row.key)} className="border-b border-border last:border-0">
                    <td className="max-w-[12rem] px-3 py-2.5">
                      <button type="button" className="inline-flex w-[11rem] max-w-[11rem] min-w-0 items-center gap-1" title={String(row.key)} onClick={() => copyText(String(row.key))}>
                        <span className="min-w-0 truncate font-mono text-xs">{String(row.key)}</span>
                        <Copy className="size-3 shrink-0 text-muted-foreground" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{row.connected ?? 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.failed ?? 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.no_answer ?? 0}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.busy ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
    </div>
  );
}

function CallLogsTab({
  calls,
  total,
  loading,
  page,
  perPage,
  filter,
  onFilter,
  onPage,
  onPerPage,
  onOpen,
}: {
  calls: VoiceCall[];
  total: number;
  loading: boolean;
  page: number;
  perPage: number;
  filter: "all" | "connected";
  onFilter: (f: "all" | "connected") => void;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
  onOpen: (call: VoiceCall) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {(["all", "connected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize",
              filter === f ? "kupe-chip-active" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : "Connected"}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                {[
                  "Call ID",
                  "User identifier",
                  "Connectivity",
                  "Failure reason",
                  "Ended by",
                  "Duration",
                  "Start time",
                  "Language",
                  "Messages",
                  "Avg agent latency",
                  "Avg user latency",
                  "Direction",
                  "Attempt #",
                  "Goal status",
                ].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={14} className="px-3 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                    </td>
                  </tr>
                ))
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">
                    No calls yet.
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <QuickContextMenu
                    key={call.id}
                    title="Call"
                    items={[
                      { label: "Open", icon: ExternalLink, onSelect: () => onOpen(call) },
                      {
                        label: "Copy call ID",
                        icon: Copy,
                        onSelect: () => copyText(call.id),
                      },
                      {
                        label: "Copy user identifier",
                        icon: Copy,
                        disabled: !call.user_identifier,
                        onSelect: () => {
                          if (call.user_identifier) copyText(call.user_identifier);
                        },
                      },
                    ]}
                  >
                    <tr className="cursor-context-menu border-b border-border hover:bg-muted/30" onClick={() => onOpen(call)}>
                    <td className="max-w-[12rem] px-3 py-2.5">
                      <CopyCell text={call.id} truncate />
                    </td>
                    <td className="max-w-[12rem] px-3 py-2.5">
                      <CopyCell text={call.user_identifier ?? "—"} truncate />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip status={call.connectivity} />
                    </td>
                    <td className="px-3 py-2.5">{call.failure_reason ?? "—"}</td>
                    <td className="px-3 py-2.5">{call.ended_by ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{call.duration_seconds != null ? `${call.duration_seconds}s` : "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{new Date(call.started_at).toLocaleString()}</td>
                    <td className="px-3 py-2.5">{call.language ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{call.message_count}</td>
                    <td className="px-3 py-2.5 tabular-nums">{call.avg_agent_latency_ms != null ? `${call.avg_agent_latency_ms}ms` : "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{call.avg_user_latency_ms != null ? `${call.avg_user_latency_ms}ms` : "—"}</td>
                    <td className="px-3 py-2.5">
                      <StatusChip status={call.direction} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{call.attempt_number}</td>
                    <td className="px-3 py-2.5">
                      <StatusChip status={call.goal_status ?? "not_evaluated"} />
                    </td>
                  </tr>
                  </QuickContextMenu>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-3">
          <VoicePagination page={page} perPage={perPage} total={total} onPageChange={onPage} onPerPageChange={onPerPage} perPageOptions={[10, 20, 50]} />
        </div>
      </div>
    </div>
  );
}

function CopyCell({ text, truncate }: { text: string; truncate?: boolean }) {
  const empty = !text || text === "—";
  return (
    <button
      type="button"
      title={empty ? undefined : text}
      disabled={empty}
      className="inline-flex w-[11rem] max-w-[11rem] min-w-0 items-center gap-1 disabled:cursor-default"
      onClick={(e) => {
        e.stopPropagation();
        if (!empty) copyText(text);
      }}
    >
      <span className={cn("min-w-0 font-mono text-xs", truncate && "truncate")}>{text}</span>
      {!empty ? <Copy className="size-3 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

function TableCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      {title ? <p className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

function EvaluationCriteriaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setNotes("");
    }
  }, [open]);

  async function submit() {
    if (!file) {
      toast.message("Choose a criteria file");
      return;
    }
    setSubmitting(true);
    try {
      await uploadEvaluationCriteria(file.name.replace(/\.[^.]+$/, ""), file);
      toast.success("Evaluation criteria uploaded");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't upload criteria — check the file is valid JSON/YAML/CSV");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload evaluation criteria</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Upload voice-AI evaluation criteria (JSON / YAML / CSV) — goals, rubrics, and success signals used to score call logs.
        </p>
        <div
          className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
        >
          <AsciiIcon kind="upload" tone="violet" size="md" />
          <p className="mt-3 text-sm font-semibold">Drop criteria file or browse</p>
          <p className="mt-1 text-xs text-muted-foreground">JSON, YAML, or CSV · voice AI rubric format</p>
          <Button type="button" className="mt-4 rounded-full" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.yaml,.yml,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
          {file ? <p className="mt-3 text-sm font-medium">{file.name}</p> : null}
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="eval-notes">Notes (optional)</Label>
          <Textarea id="eval-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Appointment cancellation success rubric v2" rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={() => void submit()} disabled={submitting}>
            <Plus className="size-3.5" />
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
