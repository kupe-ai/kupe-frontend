"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Copy, ExternalLink, Wallet as WalletIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { KupeRealtimeApiHero } from "@/components/voice-agents/kupe-realtime-api-hero";
import { TemplateAgentDialog } from "@/components/voice-agents/template-agent-dialog";
import { RecentAgentsTable } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { VoiceAgentsPageShimmer } from "@/components/ui/shimmer";
import { Matrix } from "@/components/ui/matrix";
import {
  ChartContainer,
  ChartThemeGradient,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useSession } from "@/context/session-context";
import { useWorkspace } from "@/context/workspace-context";
import { useKoriQuery } from "@/lib/hooks/use-kori-query";
import { api } from "@/lib/api";
import { formatMoney, UI_DEFAULT_CURRENCY } from "@/components/voice-agents/currency-toggle";
import {
  TEMPLATE_FILTERS,
  type TemplateCategory,
  type VoiceAgentTemplate,
} from "@/lib/voice-agents-data";
import { listVoiceAgentTemplates, listVoiceAgents } from "@/lib/api/voice/agents";
import { getAnalyticsOverview } from "@/lib/api/voice/analytics";

const chartConfig = {
  rate: {
    label: "Calls",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const INITIAL_TEMPLATE_COUNT = 6;

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const HOME_PANEL_HEIGHT = "h-[min(30rem,calc(100vh-16rem))]";

export default function VoiceAgentsHomePage() {
  const { session } = useSession();
  const { org } = useWorkspace();
  const displayName =
    session?.profile.full_name?.trim() ||
    session?.departments.find((d) => d.id === session.currentDepartmentId)?.name ||
    "there";

  const [filter, setFilter] = useState<TemplateCategory>("all");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [selected, setSelected] = useState<VoiceAgentTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const agentsQuery = useKoriQuery({
    queryKey: ["voice-agents", "home"],
    queryFn: () => listVoiceAgents({ page_size: 50 }),
  });
  const templatesQuery = useKoriQuery({
    queryKey: ["voice-agent-templates"],
    queryFn: () => listVoiceAgentTemplates(),
  });
  const analyticsQuery = useKoriQuery({
    queryKey: ["voice-analytics", "overview", "home"],
    queryFn: () => getAnalyticsOverview(),
  });
  const walletQuery = useKoriQuery({
    queryKey: ["billing", "wallet", "home", org?.id],
    queryFn: () => api.getWallet(org!.id, { currency: UI_DEFAULT_CURRENCY }),
    enabled: Boolean(org),
  });
  const wallet = walletQuery.data;
  const walletInsufficient = wallet ? !wallet.unmetered && wallet.insufficient : false;

  useEffect(() => {
    document.title = "Voice Agents · Kupe";
  }, []);

  const recentAgents = useMemo(
    () =>
      (agentsQuery.data?.items ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email ?? "",
        seed: a.avatar_seed,
        lastEdited: new Date(a.updated_at).toLocaleDateString(),
        lastEditedAt: new Date(a.updated_at).getTime(),
      })),
    [agentsQuery.data],
  );

  const templates = useMemo(
    () =>
      (templatesQuery.data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: (t.category === "all" ? "collections" : t.category) as VoiceAgentTemplate["category"],
        seed: t.seed,
        createdBy: "Kupe",
        callsCompleted: "0",
        about: t.about,
        scenario: t.scenario,
        languages: t.languages,
        tools: t.tools,
        variables: t.variables,
        systemPrompt: t.system_prompt,
        firstMessage: t.first_message,
      })),
    [templatesQuery.data],
  );

  const chartData = useMemo(() => {
    const byHour = analyticsQuery.data?.volume_by_hour ?? {};
    return Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, "0"),
      rate: Number(byHour[String(hour)] ?? byHour[hour] ?? 0),
    }));
  }, [analyticsQuery.data]);

  const totalLiveCalls = analyticsQuery.data?.total_calls ?? 0;
  const connectedCalls = analyticsQuery.data?.connected_calls ?? 0;
  const connectRate = analyticsQuery.data?.connectivity_rate ?? 0;
  const agentCount = recentAgents.length;

  const homeStats = [
    { id: "calls", label: "Total calls", value: analyticsQuery.isLoading ? "—" : String(totalLiveCalls) },
    { id: "connected", label: "Connected", value: analyticsQuery.isLoading ? "—" : String(connectedCalls) },
    { id: "rate", label: "Connect rate", value: analyticsQuery.isLoading ? "—" : `${(connectRate * 100).toFixed(0)}%` },
    { id: "agents", label: "Agents", value: String(agentCount) },
  ];

  // Last 12 hours of real call volume, normalized to 0-1, for the Matrix VU accent.
  const vuLevels = useMemo(() => {
    const recent = chartData.slice(-12);
    const max = Math.max(1, ...recent.map((d) => d.rate));
    return recent.map((d) => d.rate / max);
  }, [chartData]);

  const filteredTemplates = useMemo(() => {
    if (filter === "all") return templates;
    return templates.filter((t) => t.category === filter);
  }, [templates, filter]);

  const visibleTemplates = showAllTemplates
    ? filteredTemplates
    : filteredTemplates.slice(0, INITIAL_TEMPLATE_COUNT);

  const loading =
    (agentsQuery.isLoading && !agentsQuery.data) ||
    (templatesQuery.isLoading && !templatesQuery.data);

  if (loading) return <VoiceAgentsPageShimmer />;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[90rem]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Home</p>
          <h1 className="mt-1 text-title">
            {greetingForNow()}, {displayName}.
          </h1>
        </div>
        {wallet && !wallet.unmetered && (
          <Link
            to="/billing"
            className={cn(
              "mt-1 flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
              walletInsufficient
                ? "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
                : "border-border bg-card text-foreground hover:bg-muted/40",
            )}
          >
            <WalletIcon className="size-4" />
            {formatMoney(wallet.balance, wallet.currency)}
            <span className="text-xs font-normal opacity-70">wallet balance</span>
          </Link>
        )}
      </div>

      {walletInsufficient && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Insufficient balance — this workspace is out of credits. Calls and TTS are blocked until you</span>
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            top up
          </Link>
          <span>.</span>
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-xs md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            {homeStats.map((s) => (
              <div key={s.id}>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Volume · Hour of day</p>
            <Matrix
              rows={7}
              cols={12}
              mode="vu"
              levels={vuLevels}
              size={2.5}
              gap={0.8}
              palette={{ on: "var(--primary)", off: "var(--border)" }}
              ariaLabel="Recent call volume"
            />
          </div>
        </div>
        <ChartContainer config={chartConfig} className="mt-3 h-[180px] w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="18%">
            <defs>
              <ChartThemeGradient id="home-volume-fill" />
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} allowDecimals={false} />
            <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.35 }} content={<ChartTooltipContent />} />
            <Bar dataKey="rate" fill="url(#home-volume-fill)" radius={[6, 6, 2, 2]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 sm:gap-6 min-[900px]:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1.12fr)]">
        <div className="min-w-0">
          {recentAgents.length > 0 ? (
            <RecentAgentsTable
              title="Agents"
              agents={recentAgents}
              panelClassName={HOME_PANEL_HEIGHT}
              onChanged={() => void agentsQuery.refetch()}
            />
          ) : (
            <>
              <h2 className="mb-3 text-base font-semibold tracking-tight">Agents</h2>
              <div
                className={cn(
                  "flex flex-col justify-center rounded-xl border border-dashed border-border px-4 py-10 text-center",
                  HOME_PANEL_HEIGHT,
                )}
              >
                <p className="text-sm font-medium">No agents yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one from a template below, or mint a session with the SDK.
                </p>
              </div>
            </>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Deploy with code</h2>
          <KupeRealtimeApiHero compact className={HOME_PANEL_HEIGHT} />
        </div>
      </section>

      <section className="mt-8 pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold tracking-tight">Agent templates</h2>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setShowAllTemplates(false);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "kupe-chip-active"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibleTemplates.map((tpl) => (
            <QuickContextMenu
              key={tpl.id}
              title={tpl.name}
              items={[
                {
                  label: "Use template",
                  icon: ExternalLink,
                  onSelect: () => {
                    setSelected(tpl);
                    setDialogOpen(true);
                  },
                },
                {
                  label: "Copy name",
                  icon: Copy,
                  onSelect: () => {
                    void navigator.clipboard.writeText(tpl.name);
                    toast.message("Name copied");
                  },
                },
              ]}
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(tpl);
                  setDialogOpen(true);
                }}
                className="group/nav pressable cursor-context-menu rounded-2xl border border-border bg-card p-4 text-left shadow-xs transition-colors duration-200 hover:bg-muted/30"
              >
                <AgentAvatar seed={tpl.seed} size={36} />
                <h3 className="mt-2.5 text-sm font-semibold tracking-tight">{tpl.name}</h3>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {tpl.description}
                </p>
              </button>
            </QuickContextMenu>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">No templates in this category yet.</p>
        )}

        {!showAllTemplates && filteredTemplates.length > INITIAL_TEMPLATE_COUNT && (
          <div className="mt-5 flex justify-center">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowAllTemplates(true)}>
              View more
              <ChevronDown className="size-4" />
            </Button>
          </div>
        )}
      </section>

      <TemplateAgentDialog template={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
