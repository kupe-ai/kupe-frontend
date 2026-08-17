"use client";

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play } from "lucide-react";
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
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import {
  getCampaign,
  getCampaignStats,
  listDialJobsPage,
  pauseCampaign,
  resumeCampaign,
  type VoiceCampaign,
} from "@/lib/api/voice/campaigns";
import { api } from "@/lib/api";
import type { BatchStats, RecipientList } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type PersonRow = {
  id: string;
  phone_e164: string;
  status: string;
  raw_status: string;
  variables?: Record<string, unknown>;
  attempt_count?: number;
};

export default function VoiceAgentsOutboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<VoiceCampaign | null>(null);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [sourceList, setSourceList] = useState<RecipientList | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

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
        toast.error("Couldn't load people");
        setPeople([]);
      } finally {
        setPeopleLoading(false);
      }
    },
    [id, statusFilter],
  );

  useEffect(() => {
    if (tab === "people") void loadPeople(null, true);
  }, [tab, statusFilter, loadPeople]);

  async function onPauseResume() {
    if (!campaign) return;
    try {
      if (campaign.status === "paused" || campaign.status === "draft") {
        await resumeCampaign(campaign.id);
        toast.message(campaign.status === "draft" ? "Campaign started" : "Campaign resumed");
      } else {
        await pauseCampaign(campaign.id);
        toast.message("Campaign paused");
      }
      await refresh();
    } catch {
      toast.error("Couldn't update campaign");
    }
  }

  if (loading || !campaign) {
    return (
      <div className="voice-page flex flex-col gap-4">
        <VoiceTableShimmer rows={6} />
      </div>
    );
  }

  const contactsByStatus = stats?.contacts_by_status ?? {};

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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(contactsByStatus).length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground sm:col-span-2">
                No dial stats yet — open People after recipients are attached.
              </div>
            ) : (
              Object.entries(contactsByStatus).map(([status, count]) => (
                <div key={status} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {status.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{count.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="people" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {peopleTotal.toLocaleString()} people
              {statusFilter !== "all" ? ` · filtered by ${statusFilter}` : ""}
            </p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="exhausted">Exhausted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Phone</span>
              <span>Attempts</span>
              <span>Status</span>
            </div>
            {peopleLoading ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">Loading…</div>
            ) : people.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">No people on this page.</div>
            ) : (
              <ul className="divide-y divide-border">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-sm"
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
                    <span className="tabular-nums text-muted-foreground">{p.attempt_count ?? 0}</span>
                    <Badge
                      variant={
                        p.raw_status === "completed"
                          ? "success"
                          : p.raw_status === "failed" || p.raw_status === "exhausted"
                            ? "destructive"
                            : "outline"
                      }
                      className={cn("justify-self-end")}
                    >
                      {p.raw_status.replace(/_/g, " ")}
                    </Badge>
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
    </div>
  );
}
