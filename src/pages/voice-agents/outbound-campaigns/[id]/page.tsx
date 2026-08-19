"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, RotateCw, Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  getCampaignCallAnalytics,
  getCampaignStats,
  listDialJobsPage,
  pauseCampaign,
  removeCampaignRecipients,
  resumeCampaign,
  type VoiceCampaign,
} from "@/lib/api/voice/campaigns";
import { CallVolumeChart } from "@/components/voice-agents/call-volume-chart";
import { api } from "@/lib/api";
import {
  formatMissingVarsMessage,
  missingVariablesForContact,
  requiredVariablesForAgent,
} from "@/lib/campaign-template-vars";
import type { BatchStats, CampaignCallAnalytics, RecipientList } from "@/types";
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
  attempt_status?: string | null;
  live_status?: string | null;
};

function liveStatus(p: Pick<PersonRow, "raw_status" | "attempt_status" | "live_status">): string {
  if (p.live_status) return p.live_status;
  if (p.attempt_status === "in_progress") return "talking";
  if (p.attempt_status === "queued" || p.attempt_status === "dialing" || p.attempt_status === "ringing") {
    return "ringing";
  }
  if (p.raw_status === "pending") return "left";
  if (p.raw_status === "completed") return "done";
  return p.raw_status;
}

function statusBucket(raw: string, live?: string): "ongoing" | "done" | "left" | "other" {
  const key = live || raw;
  if (key === "talking" || key === "ringing" || raw === "in_progress") return "ongoing";
  if (raw === "completed" || raw === "failed" || raw === "exhausted" || raw === "cancelled" || key === "done") {
    return "done";
  }
  if (raw === "pending" || key === "left") return "left";
  return "other";
}

function dialBadgeVariant(live: string): "success" | "destructive" | "default" | "outline" {
  if (live === "done" || live === "completed") return "success";
  if (live === "failed" || live === "exhausted") return "destructive";
  if (live === "talking") return "default";
  return "outline";
}

function dialLabel(live: string): string {
  if (live === "talking") return "Talking";
  if (live === "ringing") return "Ringing";
  if (live === "done" || live === "completed") return "Done";
  if (live === "left" || live === "pending") return "Left";
  if (live === "in_progress") return "Ongoing";
  return live.replace(/_/g, " ");
}

export default function VoiceAgentsOutboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<VoiceCampaign | null>(null);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [callAnalytics, setCallAnalytics] = useState<CampaignCallAnalytics | null>(null);
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
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) setLoading(true);
    try {
      const c = await getCampaign(id);
      setCampaign(c);
      const [s, analytics] = await Promise.all([
        getCampaignStats(id).catch(() => null),
        getCampaignCallAnalytics(id).catch(() => null),
      ]);
      setStats(s);
      setCallAnalytics(analytics);
      if (c.recipient_list_id) {
        const list = await api.getRecipientList(c.recipient_list_id).catch(() => null);
        setSourceList(list);
      } else {
        setSourceList(null);
      }
    } catch {
      if (!opts?.silent) {
        toast.error("Couldn't load campaign");
        navigate("/outbound-campaigns");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
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
          search: searchQuery.trim() || null,
        });
        setPeople(page.items);
        setPeopleTotal(page.total);
        setPeopleNext(page.next_cursor);
        if (replaceStack) {
          setSelectedIds(new Set());
          setCursorStack([null]);
        }
      } catch {
        toast.error("Couldn't load recipients");
        setPeople([]);
      } finally {
        setPeopleLoading(false);
      }
    },
    [id, statusFilter, searchQuery],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (tab === "recipients") void loadPeople(null, true);
  }, [tab, statusFilter, searchQuery, loadPeople]);

  useEffect(() => {
    if (!id || campaign?.status !== "running") return;
    const tick = window.setInterval(() => {
      void refresh({ silent: true });
      if (tab === "recipients") {
        const cursor = cursorStack[cursorStack.length - 1] ?? null;
        void loadPeople(cursor);
      }
    }, 2500);
    return () => window.clearInterval(tick);
  }, [id, campaign?.status, tab, cursorStack, refresh, loadPeople]);

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

  async function confirmRemoveRecipients() {
    if (!campaign || removing || selectedIds.size === 0) return;
    setRemoving(true);
    try {
      const result = await removeCampaignRecipients(campaign.id, [...selectedIds]);
      toast.message(
        result.deleted === 1 ? "Removed 1 recipient" : `Removed ${result.deleted} recipients`,
      );
      setRemoveOpen(false);
      setSelectedIds(new Set());
      const cursor = cursorStack[cursorStack.length - 1] ?? null;
      await loadPeople(cursor);
      const s = await getCampaignStats(campaign.id).catch(() => null);
      setStats(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove recipients");
    } finally {
      setRemoving(false);
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
  const attemptsByStatus = stats?.attempts_by_status ?? {};
  const overview = useMemo(() => {
    const pending = contactsByStatus.pending ?? 0;
    const inProgress = contactsByStatus.in_progress ?? 0;
    const completed = contactsByStatus.completed ?? 0;
    const failed = (contactsByStatus.failed ?? 0) + (contactsByStatus.exhausted ?? 0);
    const cancelled = contactsByStatus.cancelled ?? 0;
    const total = Object.values(contactsByStatus).reduce((a, b) => a + b, 0);
    const answered = completed;
    const talking = attemptsByStatus.in_progress ?? 0;
    const ringing =
      (attemptsByStatus.queued ?? 0) + (attemptsByStatus.dialing ?? 0) + (attemptsByStatus.ringing ?? 0);
    const ongoing = talking || inProgress;
    const left = pending;
    const done = completed + failed + cancelled;
    const answerRate = total > 0 ? answered / total : 0;
    return { total, answered, ongoing, talking, ringing, left, done, failed, cancelled, answerRate };
  }, [contactsByStatus, attemptsByStatus]);

  const statusBars = useMemo(
    () =>
      [
        { key: "pending", label: "Left", count: overview.left },
        { key: "talking", label: "Talking", count: overview.talking },
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

  const canEditRecipients = campaign.status === "draft";
  const selectableIds = people.filter((p) => p.raw_status === "pending").map((p) => p.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectableIds.some((id) => selectedIds.has(id));
  const rowCols = canEditRecipients
    ? "grid-cols-[2.25rem_minmax(0,1fr)_6rem_8rem]"
    : "grid-cols-[minmax(0,1fr)_6rem_8rem]";

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
          {overview.total === 0 && !callAnalytics?.total_calls ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Attach recipients and start the campaign to see analytics.
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { id: "total", label: "Total recipients", value: overview.total.toLocaleString() },
                  { id: "answered", label: "Answered", value: overview.answered.toLocaleString() },
                  { id: "talking", label: "Talking", value: overview.talking.toLocaleString() },
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

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    id: "connected",
                    label: "Connected",
                    value: String(callAnalytics?.connected_calls ?? overview.answered),
                  },
                  {
                    id: "connect-rate",
                    label: "Connectivity rate",
                    value: `${(((callAnalytics?.connectivity_rate ?? overview.answerRate) * 100) || 0).toFixed(1)}%`,
                  },
                ].map((k) => (
                  <div key={k.id} className="rounded-xl border border-border bg-card px-3 py-3 text-left">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
                  </div>
                ))}
              </div>

              <CallVolumeChart
                byHour={callAnalytics?.volume_by_hour ?? {}}
                gradientId="campaign-volume-fill"
              />

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
              { label: "Talking", value: overview.talking, tone: "text-foreground" },
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
              {statusFilter !== "all" ? ` · filtered by ${dialLabel(statusFilter)}` : ""}
              {searchQuery ? ` · “${searchQuery}”` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canEditRecipients && selectedIds.size > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setRemoveOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Remove {selectedIds.size}
                </Button>
              ) : null}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search phone…"
                  className="w-[200px] pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="talking">Talking</SelectItem>
                  <SelectItem value="ringing">Ringing</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="exhausted">Exhausted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div
              className={cn(
                "grid gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground",
                rowCols,
              )}
            >
              {canEditRecipients ? (
                <Checkbox
                  aria-label="Select all recipients"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  disabled={selectableIds.length === 0}
                  onCheckedChange={(checked) => {
                    setSelectedIds(checked === true ? new Set(selectableIds) : new Set());
                  }}
                />
              ) : null}
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
                {people.map((p) => {
                  const canSelect = canEditRecipients && p.raw_status === "pending";
                  const live = liveStatus(p);
                  return (
                    <li
                      key={p.id}
                      className={cn("grid items-center gap-3 px-4 py-2.5 text-sm", rowCols)}
                    >
                      {canEditRecipients ? (
                        <Checkbox
                          aria-label={`Select ${p.phone_e164}`}
                          checked={selectedIds.has(p.id)}
                          disabled={!canSelect}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked === true) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            });
                          }}
                        />
                      ) : null}
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
                          variant={dialBadgeVariant(live)}
                          className={cn(statusBucket(p.raw_status, live) === "ongoing" && "border-primary/40 bg-primary/10")}
                        >
                          {dialLabel(live)}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
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

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {selectedIds.size === 1 ? "this recipient" : `${selectedIds.size} recipients`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be taken off this campaign. Saved people lists are unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={removing} onClick={() => void confirmRemoveRecipients()}>
              {removing ? "Removing…" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
