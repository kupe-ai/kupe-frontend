"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, RotateCw, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChartContainer,
  ChartThemeGradient,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import {
  canDeleteCampaign,
  cloneCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignStats,
  listDialJobsPage,
  pauseCampaign,
  resumeCampaign,
  type VoiceCampaign,
} from "@/lib/api/voice/campaigns";
import { api } from "@/lib/api";
import {
  formatMissingVarsMessage,
  missingVariablesForContact,
  requiredVariablesForAgent,
} from "@/lib/campaign-template-vars";
import type { BatchStats, RecipientList } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const statusChartConfig = {
  count: { label: "Recipients", color: "var(--primary)" },
} satisfies ChartConfig;

type PersonRow = {
  id: string;
  phone_e164: string;
  status: string;
  raw_status: string;
  variables?: Record<string, unknown>;
  attempt_count?: number;
};

function statusBucket(raw: string): "ongoing" | "done" | "left" | "other" {
  if (raw === "in_progress") return "ongoing";
  if (raw === "completed" || raw === "failed" || raw === "exhausted" || raw === "cancelled") {
    return "done";
  }
  if (raw === "pending") return "left";
  return "other";
}

function dialBadgeVariant(raw: string): "success" | "destructive" | "default" | "outline" {
  if (raw === "completed") return "success";
  if (raw === "failed" || raw === "exhausted") return "destructive";
  if (raw === "in_progress") return "default";
  return "outline";
}

function dialLabel(raw: string): string {
  if (raw === "in_progress") return "Ongoing";
  if (raw === "completed") return "Done";
  if (raw === "pending") return "Left";
  return raw.replace(/_/g, " ");
}

export default function VoiceAgentsOutboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<VoiceCampaign | null>(null);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [sourceList, setSourceList] = useState<RecipientList | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  const [people, setPeople] = useState<PersonRow[]>([]);
  const [peopleTotal, setPeopleTotal] = useState(0);
  const [peopleNext, setPeopleNext] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [peopleLoading, setPeopleLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await getCampaign(id);
      setCampaign(c);
      const s = await getCampaignStats(id).catch(() => null);
      setStats(s);
      if (c.recipient_list_id) {
        const list = await api.getRecipientList(c.recipient_list_id).catch(() => null);
        setSourceList(list);
      } else {
        setSourceList(null);
      }
    } catch {
      toast.error("Couldn't load campaign");
      navigate("/outbound-campaigns");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    document.title = "Campaign · Voice Agents · Kupe";
    void refresh();
  }, [refresh]);

  const loadPeople = useCallback(
    async (cursor: string | null, replaceStack = false) => {
      if (!id) return;
      setPeopleLoading(true);
      try {
        const page = await listDialJobsPage(id, {
          limit: PAGE_SIZE,
          cursor: cursor ?? "",
          status: statusFilter === "all" ? null : statusFilter,
        });
        setPeople(page.items);
        setPeopleTotal(page.total);
        setPeopleNext(page.next_cursor);
        if (replaceStack) setCursorStack([null]);
      } catch {
        toast.error("Couldn't load recipients");
        setPeople([]);
      } finally {
        setPeopleLoading(false);
      }
    },
    [id, statusFilter],
  );

  useEffect(() => {
    if (tab === "recipients") void loadPeople(null, true);
  }, [tab, statusFilter, loadPeople]);

  async function onRerun() {
    if (!campaign || rerunning) return;
    setRerunning(true);
    try {
      const copy = await cloneCampaign(campaign.id);
      toast.message("Campaign copied — start it when you're ready");
      navigate(`/outbound-campaigns/${copy.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't re-run campaign");
    } finally {
      setRerunning(false);
    }
  }

  async function onPauseResume() {
    if (!campaign) return;
    try {
      if (campaign.status === "paused" || campaign.status === "draft") {
        if (campaign.status === "draft") {
          const agent = await api.getAgent(campaign.agent_id);
          const required = requiredVariablesForAgent(agent);
          if (required.length > 0) {
            const page = await api.listBatchContactsCursor(campaign.id, {
              limit: 100,
              cursor: "",
              status: "pending",
            });
            for (const contact of page.items) {
              const missing = missingVariablesForContact(required, contact.variables);
              if (missing.length) {
                toast.error(
                  formatMissingVarsMessage(missing, {
                    phone: contact.phone_number,
                    more: Math.max(0, page.total - 1),
                  }),
                );
                setTab("recipients");
                return;
              }
            }
            if (page.total === 0) {
              toast.error("Add recipients before starting this campaign");
              setTab("recipients");
              return;
            }
          }
        }
        await resumeCampaign(campaign.id);
        toast.message(campaign.status === "draft" ? "Campaign started" : "Campaign resumed");
      } else {
        await pauseCampaign(campaign.id);
        toast.message("Campaign paused");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update campaign");
    }
  }

  async function confirmDelete() {
    if (!campaign || deleting) return;
    setDeleting(true);
    try {
      await deleteCampaign(campaign.id);
      toast.message("Campaign deleted");
      navigate("/outbound-campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete campaign");
    } finally {
      setDeleting(false);
    }
  }

  const contactsByStatus = stats?.contacts_by_status ?? {};
  const overview = useMemo(() => {
    const pending = contactsByStatus.pending ?? 0;
    const inProgress = contactsByStatus.in_progress ?? 0;
    const completed = contactsByStatus.completed ?? 0;
    const failed = (contactsByStatus.failed ?? 0) + (contactsByStatus.exhausted ?? 0);
    const cancelled = contactsByStatus.cancelled ?? 0;
    const total = Object.values(contactsByStatus).reduce((a, b) => a + b, 0);
    const answered = completed;
    const ongoing = inProgress;
    const left = pending;
    const done = completed + failed + cancelled;
    const answerRate = total > 0 ? answered / total : 0;
    return { total, answered, ongoing, left, done, failed, cancelled, answerRate };
  }, [contactsByStatus]);

  const statusBars = useMemo(
    () =>
      [
        { key: "pending", label: "Left", count: overview.left },
        { key: "in_progress", label: "Ongoing", count: overview.ongoing },
        { key: "completed", label: "Answered", count: overview.answered },
        { key: "failed", label: "Failed", count: overview.failed },
      ].filter((r) => r.count > 0 || overview.total > 0),
    [overview],
  );

  if (loading || !campaign) {
    return (
      <div className="voice-page flex flex-col gap-4">
        <VoiceTableShimmer rows={6} />
      </div>
    );
  }

  return (
    <div className="voice-page flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="rounded-full" asChild>
          <Link to="/outbound-campaigns">
            <ArrowLeft className="size-4" />
            Campaigns
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{campaign.name}</h1>
            <StatusChip status={campaign.status} />
          </div>
          {sourceList ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              From list <span className="font-medium text-foreground">{sourceList.name}</span> ·{" "}
              {sourceList.member_count.toLocaleString()} people saved
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canDeleteCampaign(campaign) ? (
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : null}
          {campaign.status === "completed" ? (
            <Button className="rounded-full" disabled={rerunning} onClick={() => void onRerun()}>
              <RotateCw className="size-4" />
              {rerunning ? "Copying…" : "Re-run"}
            </Button>
          ) : null}
          {(campaign.status === "running" ||
            campaign.status === "paused" ||
            campaign.status === "draft") && (
            <Button variant="outline" className="rounded-full" onClick={() => void onPauseResume()}>
              {campaign.status === "running" ? (
                <>
                  <Pause className="size-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="size-4" /> {campaign.status === "draft" ? "Start" : "Resume"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {overview.total === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Attach recipients and start the campaign to see analytics.
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { id: "total", label: "Total recipients", value: overview.total.toLocaleString() },
                  { id: "answered", label: "Answered", value: overview.answered.toLocaleString() },
                  { id: "ongoing", label: "Ongoing", value: overview.ongoing.toLocaleString() },
                  { id: "left", label: "Left", value: overview.left.toLocaleString() },
                  { id: "failed", label: "Failed", value: overview.failed.toLocaleString() },
                  {
                    id: "rate",
                    label: "Answer rate",
                    value: `${(overview.answerRate * 100).toFixed(1)}%`,
                  },
                ].map((k) => (
                  <div key={k.id} className="rounded-xl border border-border bg-card px-3 py-3 text-left">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-sm font-semibold">Recipients by status</p>
                {statusBars.every((r) => r.count === 0) ? (
                  <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                    No dial activity yet
                  </div>
                ) : (
                  <ChartContainer config={statusChartConfig} className="h-[220px] w-full">
                    <BarChart data={statusBars}>
                      <defs>
                        <ChartThemeGradient id="campaign-status-fill" />
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={28}
                        tick={{ fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        fill="url(#campaign-status-fill)"
                        radius={[6, 6, 2, 2]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="recipients" className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Ongoing", value: overview.ongoing, tone: "text-foreground" },
              { label: "Done", value: overview.done, tone: "text-foreground" },
              { label: "Left", value: overview.left, tone: "text-foreground" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.tone)}>
                  {s.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {peopleTotal.toLocaleString()} recipients
              {statusFilter !== "all" ? ` · filtered by ${statusFilter.replace(/_/g, " ")}` : ""}
            </p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Left</SelectItem>
                <SelectItem value="in_progress">Ongoing</SelectItem>
                <SelectItem value="completed">Done</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="exhausted">Exhausted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_8rem] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Phone</span>
              <span className="text-center">Attempts</span>
              <span className="text-center">Status</span>
            </div>
            {peopleLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : people.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recipients on this page.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[minmax(0,1fr)_6rem_8rem] items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[13px]">{p.phone_e164}</p>
                      {p.variables && Object.keys(p.variables).length > 0 ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {Object.entries(p.variables)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}=${String(v)}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-center tabular-nums text-muted-foreground">
                      {p.attempt_count ?? 0}
                    </span>
                    <div className="flex justify-center">
                      <Badge
                        variant={dialBadgeVariant(p.raw_status)}
                        className={cn(
                          statusBucket(p.raw_status) === "ongoing" && "border-primary/40 bg-primary/10",
                        )}
                      >
                        {dialLabel(p.raw_status)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {people.length ? people.length : 0} of {peopleTotal.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={peopleLoading || cursorStack.length <= 1}
                onClick={() => {
                  const stack = cursorStack.slice(0, -1);
                  const prev = stack[stack.length - 1] ?? null;
                  setCursorStack(stack);
                  void loadPeople(prev);
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={peopleLoading || !peopleNext}
                onClick={() => {
                  if (!peopleNext) return;
                  setCursorStack((s) => [...s, peopleNext]);
                  void loadPeople(peopleNext);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This campaign has never been started and can be removed. Campaigns that have run cannot
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
