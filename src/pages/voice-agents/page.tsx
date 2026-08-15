"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { PetSprite } from "@/components/pets/pet-sprite";
import { TemplateAgentDialog } from "@/components/voice-agents/template-agent-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceAgentsPageShimmer } from "@/components/ui/shimmer";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(3);
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

  const filteredRecents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recentAgents
      .filter((a) => {
        if (!q) return true;
        return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
      })
      .sort((a, b) => (sortDesc ? b.lastEditedAt - a.lastEditedAt : a.lastEditedAt - b.lastEditedAt));
  }, [recentAgents, search, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filteredRecents.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageItems = filteredRecents.slice(pageStart, pageStart + perPage);
  const rangeFrom = filteredRecents.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageStart + perPage, filteredRecents.length);

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

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
          <div>
            <p className="text-sm text-muted-foreground">Total calls</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {analyticsQuery.isLoading ? "—" : totalLiveCalls}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Volume · Hour of day</p>
        </div>
        <ChartContainer config={chartConfig} className="mt-3 h-[180px] w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="18%">
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
            <Bar dataKey="rate" fill="var(--color-rate)" radius={4} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Recents</h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-9 rounded-full pl-8"
              aria-label="Search recent agents"
            />
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Agent</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground"
              onClick={() => setSortDesc((v) => !v)}
            >
              Last edited
              <ArrowDown className={cn("size-3.5 transition-transform", !sortDesc && "rotate-180")} />
            </button>
          </div>

          {pageItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {recentAgents.length === 0 ? "No agents yet — create one from Agents." : "No agents match your search."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pageItems.map((agent) => (
                <li key={agent.id}>
                  <Link
                    to={`/voice-agents/agents/${agent.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                        <PetSprite seed={agent.seed} size={20} frame="stand" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{agent.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">{agent.lastEdited}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show</span>
              <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                <SelectTrigger size="sm" className="h-7 w-[4.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>Per page</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {rangeFrom}-{rangeTo} of {filteredRecents.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
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
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                setSelected(tpl);
                setDialogOpen(true);
              }}
              className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                <PetSprite seed={tpl.seed} size={22} frame="stand" />
              </div>
              <h3 className="mt-2.5 text-sm font-semibold tracking-tight">{tpl.name}</h3>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {tpl.description}
              </p>
            </button>
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
