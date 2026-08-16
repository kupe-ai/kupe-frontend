"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, ExternalLink } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
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
import { useKoriQuery } from "@/lib/hooks/use-kori-query";
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

export default function VoiceAgentsHomePage() {
  const { session } = useSession();
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
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
      <p className="text-sm text-muted-foreground">Home</p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
        {greetingForNow()}, {displayName}.
      </h1>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
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

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Recents</h2>
        <RecentAgentsTable
          agents={recentAgents}
          onChanged={() => void agentsQuery.refetch()}
        />
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

        <div className="stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                className="group/nav pressable cursor-context-menu rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-transform duration-200 [transition-timing-function:var(--ease-pop)] hover:-translate-y-0.5 hover:bg-muted/30"
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
