"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Eye, EyeOff, Pause, Play, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { useSession } from "@/context/session-context";
import { listVoiceAgents } from "@/lib/api/voice/agents";
import {
  canDeleteCampaign,
  cloneCampaign,
  createCampaign,
  deleteCampaign,
  ensureCampaignRecipients,
  hideCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  unhideAllCampaigns,
  updateCampaignSchedule,
  EMPTY_BATCH_SCHEDULE,
  type BatchSchedule,
  type VoiceCampaign,
} from "@/lib/api/voice/campaigns";
import { listPhoneNumbers, type VoicePhoneNumber } from "@/lib/api/voice/telephony";
import type { VoiceAgent } from "@/lib/api/voice/types";
import { analyzeRecipients } from "@/lib/parse-recipients-csv";
import {
  formatMissingVarsMessage,
  missingColumnsForRecipients,
  missingVariablesForContact,
  requiredVariablesForAgent,
} from "@/lib/campaign-template-vars";
import { api } from "@/lib/api";
import type { Agent } from "@/types";
import { PeopleListsPanel } from "./people-lists-panel";
import { RecipientsStep, createEmptyRecipientsState, type RecipientsState } from "./recipients-step";

const STEPS = ["Agent", "Recipients", "Schedule", "Review & Launch"] as const;

export default function VoiceAgentsOutboundPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [peopleCreateOpen, setPeopleCreateOpen] = useState(false);
  const [pageTab, setPageTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<VoiceCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    listCampaigns()
      .then(setCampaigns)
      .catch(() => {
        if (!opts?.silent) setCampaigns([]);
      })
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    document.title = "Outbound campaigns · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  const anyRunning = campaigns.some((c) => c.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const tick = window.setInterval(() => refresh({ silent: true }), 2500);
    return () => window.clearInterval(tick);
  }, [anyRunning, refresh]);

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteCampaign(toDelete.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== toDelete.id));
      toast.message("Campaign deleted");
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete campaign");
    } finally {
      setDeleting(false);
    }
  }

  async function onHide(campaign: VoiceCampaign) {
    try {
      await hideCampaign(campaign.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      toast.message("Campaign hidden");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't hide campaign");
    }
  }

  async function onUnhideAll() {
    try {
      const { unhidden } = await unhideAllCampaigns();
      if (unhidden === 0) {
        toast.message("No hidden campaigns");
      } else {
        toast.message(unhidden === 1 ? "Unhid 1 campaign" : `Unhid ${unhidden} campaigns`);
        refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't unhide campaigns");
    }
  }

  return (
    <QuickContextMenu
      items={[{ label: "Unhide all campaigns", icon: Eye, onSelect: () => void onUnhideAll() }]}
    >
    <div className="voice-page flex min-h-[70vh] flex-col">
      <VoicePageHeader
        title="Outbound campaigns"
        actions={
          pageTab === "people" ? (
            <Button className="group/nav rounded-full" onClick={() => setPeopleCreateOpen(true)}>
              <KupeIcon name="plus" className="size-4" />
              Create people list
            </Button>
          ) : campaigns.length > 0 ? (
            <Button className="group/nav rounded-full" onClick={() => setOpen(true)}>
              <KupeIcon name="plus" className="size-4" />
              Create campaign
            </Button>
          ) : undefined
        }
      />

      <Tabs value={pageTab} onValueChange={setPageTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          {loading ? (
            <VoiceTableShimmer rows={4} />
          ) : campaigns.length === 0 ? (
            <AsciiEmptyState
              kind="campaign"
              tone="coral"
              title="Reach thousands of customers by phone"
              description="Upload contacts, pick an agent, launch calls."
              className="min-h-[65vh]"
              actions={
                <>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => navigate("/deploy-with-code/apis/batch-outbound")}
                  >
                    Build with API →
                  </Button>
                  <Button className="group/nav rounded-full" onClick={() => setOpen(true)}>
                    <KupeIcon name="plus" className="size-4" />
                    Create campaign
                  </Button>
                </>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span>Campaign</span>
                <span>Status</span>
              </div>
              <ul className="divide-y divide-border">
                {campaigns.map((c) => {
                  const items: {
                    label: string;
                    icon: typeof Copy;
                    variant?: "default" | "destructive";
                    onSelect: () => void;
                  }[] = [
                    {
                      label: "Copy name",
                      icon: Copy,
                      onSelect: () => {
                        void navigator.clipboard.writeText(c.name);
                        toast.message("Name copied");
                      },
                    },
                  ];
                  if (c.status === "paused" || c.status === "draft") {
                    items.push({
                      label: c.status === "draft" ? "Start" : "Resume",
                      icon: Play,
                      onSelect: () => {
                        void (async () => {
                          try {
                            if (c.status === "draft") {
                              const agent = await api.getAgent(c.agent_id);
                              const required = requiredVariablesForAgent(agent);
                              if (required.length > 0) {
                                const page = await api.listBatchContactsCursor(c.id, {
                                  limit: 100,
                                  cursor: "",
                                  status: "pending",
                                });
                                for (const contact of page.items) {
                                  const missing = missingVariablesForContact(
                                    required,
                                    contact.variables,
                                  );
                                  if (missing.length) {
                                    toast.error(
                                      formatMissingVarsMessage(missing, {
                                        phone: contact.phone_number,
                                        more: Math.max(0, page.total - 1),
                                      }),
                                    );
                                    navigate(`/outbound-campaigns/${c.id}`);
                                    return;
                                  }
                                }
                              }
                            }
                            await resumeCampaign(c.id);
                            toast.message(c.status === "draft" ? "Campaign started" : "Campaign resumed");
                            refresh();
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Couldn't resume campaign",
                            );
                          }
                        })();
                      },
                    });
                  } else if (c.status === "running") {
                    items.push({
                      label: "Pause",
                      icon: Pause,
                      onSelect: () => {
                        void pauseCampaign(c.id)
                          .then(() => {
                            toast.message("Campaign paused");
                            refresh();
                          })
                          .catch(() => toast.error("Couldn't pause campaign"));
                      },
                    });
                  } else if (c.status === "completed") {
                    items.push({
                      label: "Re-run",
                      icon: RotateCw,
                      onSelect: () => {
                        void (async () => {
                          try {
                            const copy = await cloneCampaign(c.id);
                            toast.message("Campaign copied — start it when you're ready");
                            navigate(`/outbound-campaigns/${copy.id}`);
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Couldn't re-run campaign",
                            );
                          }
                        })();
                      },
                    });
                  }
                  if (canDeleteCampaign(c)) {
                    items.push({
                      label: "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      onSelect: () => setToDelete(c),
                    });
                  }
                  items.push({
                    label: "Hide",
                    icon: EyeOff,
                    onSelect: () => void onHide(c),
                  });
                  items.push({
                    label: "Unhide all campaigns",
                    icon: Eye,
                    onSelect: () => void onUnhideAll(),
                  });
                  return (
                    <QuickContextMenu key={c.id} title={c.name} items={items}>
                      <li
                        className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40"
                        onClick={() => navigate(`/outbound-campaigns/${c.id}`)}
                      >
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <StatusChip status={c.status} />
                      </li>
                    </QuickContextMenu>
                  );
                })}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="people" className="mt-4">
          <PeopleListsPanel createOpen={peopleCreateOpen} onCreateOpenChange={setPeopleCreateOpen} />
        </TabsContent>
      </Tabs>

      <ScheduleCampaignDialog open={open} onOpenChange={setOpen} onCreated={refresh} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" has never been started and can be removed. Campaigns that have run cannot be deleted.`
                : null}
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
    </QuickContextMenu>
  );
}

function ScheduleCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { session } = useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [connection, setConnection] = useState("");
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [numbers, setNumbers] = useState<VoicePhoneNumber[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientsState>(createEmptyRecipientsState);
  const [recipientSummary, setRecipientSummary] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [schedule, setSchedule] = useState<BatchSchedule>(EMPTY_BATCH_SCHEDULE);
  const [listsAttached, setListsAttached] = useState(false);
  const [boundListId, setBoundListId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const recipientPeople = analyzeRecipients(recipients.columns, recipients.rows).people;
  const requiredVars = requiredVariablesForAgent(selectedAgent);

  useEffect(() => {
    if (open) {
      setStep(0);
      setName("");
      setAgentId("");
      setConnection("");
      setCampaignId(null);
      setRecipients(createEmptyRecipientsState());
      setRecipientSummary(null);
      setListsAttached(false);
      setBoundListId(null);
      setSchedule(EMPTY_BATCH_SCHEDULE);
      setSelectedAgent(null);
      listVoiceAgents({ page_size: 100 }).then((res) => setAgents(res.items)).catch(() => setAgents([]));
      listPhoneNumbers().then((rows) => setNumbers(rows.filter((n) => n.status === "active"))).catch(() => setNumbers([]));
    }
  }, [open]);

  useEffect(() => {
    if (!agentId) {
      setSelectedAgent(null);
      return;
    }
    let cancelled = false;
    api
      .getAgent(agentId)
      .then((a) => {
        if (!cancelled) setSelectedAgent(a);
      })
      .catch(() => {
        if (!cancelled) setSelectedAgent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function assertRecipientsMatchAgent(): Promise<boolean> {
    if (requiredVars.length === 0) return true;

    if (recipients.mode === "new") {
      const missingCols = missingColumnsForRecipients(requiredVars, recipients.columns);
      if (missingCols.length) {
        toast.error(formatMissingVarsMessage(missingCols));
        return false;
      }
      return true;
    }

    if (!recipients.selectedListId) return true;
    try {
      const page = await api.listRecipientListMembers(recipients.selectedListId, { limit: 100 });
      for (const member of page.items) {
        const missing = missingVariablesForContact(requiredVars, member.variables);
        if (missing.length) {
          toast.error(
            formatMissingVarsMessage(missing, {
              phone: member.phone_number,
              more: Math.max(0, page.total - 1),
            }),
          );
          return false;
        }
      }
    } catch {
      toast.error("Couldn't verify recipient variables for this agent");
      return false;
    }
    return true;
  }

  async function next() {
    if (step === 0) {
      if (!name.trim() || !agentId || !connection) {
        toast.message("Fill required fields");
        return;
      }
      if (!campaignId) {
        const orgId = session?.profile.organization_id;
        const workspaceId = session?.currentDepartmentId;
        if (!orgId || !workspaceId) {
          toast.error("No active workspace");
          return;
        }
        try {
          const campaign = await createCampaign(orgId, workspaceId, {
            name: name.trim(),
            agent_id: agentId,
            connection_config: {
              phone_number_id: connection,
              sip_trunk_id: numbers.find((n) => n.id === connection)?.sip_trunk_id,
            },
          });
          setCampaignId(campaign.id);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't create campaign");
          return;
        }
      }
    }
    if (step === 1) {
      const activeCampaignId = campaignId;
      if (!activeCampaignId) {
        toast.error("Create the campaign first");
        return;
      }
      if (recipients.mode === "new") {
        if (!recipients.listName.trim()) {
          toast.message("Name this recipient list");
          return;
        }
        if (recipientPeople === 0) {
          toast.message("Add at least one recipient with a phone number");
          return;
        }
      } else if (!recipients.selectedListId) {
        toast.message("Pick a saved recipient list");
        return;
      }
      if (!(await assertRecipientsMatchAgent())) return;
      if (!listsAttached) {
        try {
          const result = await ensureCampaignRecipients({
            campaignId: activeCampaignId,
            mode: recipients.mode,
            listName: recipients.listName,
            selectedListId: recipients.selectedListId,
            boundListId,
            alreadyAttached: false,
            columns: recipients.columns,
            rows: recipients.rows,
          });
          setBoundListId(result.listId);
          setRecipientSummary(`${result.copied} contacts from list`);
          setListsAttached(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't save recipients");
          return;
        }
      }
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    void launch();
  }

  async function launch() {
    if (!campaignId) return;
    if (!(await assertRecipientsMatchAgent())) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      // Final check against contacts already on the batch (covers saved-list edge cases).
      if (requiredVars.length > 0) {
        const page = await api.listBatchContactsCursor(campaignId, { limit: 100, cursor: "" });
        for (const contact of page.items) {
          const missing = missingVariablesForContact(requiredVars, contact.variables);
          if (missing.length) {
            toast.error(
              formatMissingVarsMessage(missing, {
                phone: contact.phone_number,
                more: Math.max(0, page.total - 1),
              }),
            );
            setStep(1);
            setSubmitting(false);
            return;
          }
        }
      }
      if (schedule.recurrence) {
        await updateCampaignSchedule(campaignId, schedule);
        toast.success("Campaign scheduled");
      } else {
        await resumeCampaign(campaignId);
        toast.success("Campaign launched");
      }
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't launch campaign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,44rem)] w-[min(96vw,42rem)] max-w-2xl flex-col gap-0 overflow-hidden sm:max-w-2xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Schedule campaign</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex shrink-0 flex-wrap gap-3 border-b border-border sm:gap-4">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "pressable border-b-2 pb-2 text-sm",
                i === step ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {step === 0 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Campaign name <span className="text-destructive">*</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter campaign name" disabled={!!campaignId} />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Select agent <span className="text-destructive">*</span>
                </Label>
                <Select value={agentId} onValueChange={setAgentId} disabled={!!campaignId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <Label>
                  Connection (active number) <span className="text-destructive">*</span>
                </Label>
                <div className="mt-1.5">
                  <Select value={connection} onValueChange={setConnection} disabled={!!campaignId}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder={numbers.length ? "Select a number" : "No active numbers — rent one first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {numbers.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.e164_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <RecipientsStep
              value={recipients}
              onChange={(next) => {
                setRecipients(next);
                if (next.mode !== recipients.mode) {
                  setListsAttached(false);
                } else if (next.mode === "saved" && next.selectedListId !== boundListId) {
                  setListsAttached(false);
                }
              }}
              requiredVariables={requiredVars}
            />
          ) : null}

          {step === 2 ? <ScheduleStep schedule={schedule} onChange={setSchedule} /> : null}

          {step === 3 ? (
            <div className="space-y-3 py-4 text-sm">
              <p className="font-medium">Review & Launch</p>
              <dl className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                <Row label="Campaign" value={name || "—"} />
                <Row label="Agent" value={agents.find((a) => a.id === agentId)?.name || "—"} />
                <Row label="Connection" value={numbers.find((n) => n.id === connection)?.e164_number || "—"} />
                <Row
                  label="Recipients"
                  value={
                    recipientSummary ??
                    (recipients.mode === "saved"
                      ? "Saved list"
                      : `${recipientPeople} ${recipientPeople === 1 ? "contact" : "contacts"}`)
                  }
                />
                <Row label="Schedule" value={scheduleSummary(schedule)} />
              </dl>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-4 shrink-0 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step > 0 ? (
              <Button variant="secondary" className="rounded-full" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            <Button
              className="rounded-full"
              onClick={() => void next()}
              disabled={
                submitting ||
                (step === 1 &&
                  ((recipients.mode === "new" &&
                    (recipientPeople === 0 || !recipients.listName.trim())) ||
                    (recipients.mode === "saved" && !recipients.selectedListId)))
              }
            >
              {step === STEPS.length - 1 ? (submitting ? "Launching…" : "Launch") : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleSummary(s: BatchSchedule): string {
  if (!s.recurrence) return "Start now — dials immediately on launch";
  const limit = s.limit_per_period ? `, up to ${s.limit_per_period} calls/period` : "";
  const window = s.window_start && s.window_end ? ` (${s.window_start}–${s.window_end} ${s.timezone})` : "";
  if (s.recurrence === "once") return `Once — ${s.start_at ? new Date(s.start_at).toLocaleString() : "no date set"}`;
  if (s.recurrence === "daily") return `Every day${window}${limit}`;
  if (s.recurrence === "weekly") {
    const days = s.days_of_week.length ? s.days_of_week.map((d) => DAY_LABELS[d]).join(", ") : "every day";
    return `Weekly on ${days}${window}${limit}`;
  }
  return `Monthly on day ${s.day_of_month ?? 1}${window}${limit}`;
}

function ScheduleStep({
  schedule,
  onChange,
}: {
  schedule: BatchSchedule;
  onChange: (s: BatchSchedule) => void;
}) {
  const mode: "now" | "recurring" = schedule.recurrence ? "recurring" : "now";

  function patch(p: Partial<BatchSchedule>) {
    onChange({ ...schedule, ...p });
  }

  return (
    <div className="space-y-4 py-4 text-sm">
      <p className="font-medium">Schedule</p>

      <div className="inline-flex rounded-full bg-muted/70 p-1">
        {(
          [
            ["now", "Start now"],
            ["recurring", "Recurring"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              patch(id === "now" ? { recurrence: null } : { recurrence: "daily", timezone: schedule.timezone })
            }
            className={cn(
              "pressable rounded-full px-3.5 py-1.5 text-sm",
              mode === id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "now" && (
        <p className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-muted-foreground">
          Campaign dials sequentially starting immediately on launch.
        </p>
      )}

      {mode === "recurring" && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Repeats</Label>
              <Select
                value={schedule.recurrence ?? "daily"}
                onValueChange={(v) => patch({ recurrence: v as BatchSchedule["recurrence"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max calls per period</Label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={schedule.limit_per_period ?? ""}
                onChange={(e) => patch({ limit_per_period: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          {schedule.recurrence === "weekly" && (
            <div className="space-y-1.5">
              <Label>On these days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, dow) => {
                  const active = schedule.days_of_week.includes(dow);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        patch({
                          days_of_week: active
                            ? schedule.days_of_week.filter((d) => d !== dow)
                            : [...schedule.days_of_week, dow].sort(),
                        })
                      }
                      className={cn(
                        "pressable rounded-full border px-3 py-1 text-xs font-medium",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {schedule.recurrence === "monthly" && (
            <div className="space-y-1.5">
              <Label>Day of month</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={schedule.day_of_month ?? 1}
                onChange={(e) => patch({ day_of_month: Number(e.target.value) || 1 })}
                className="w-24"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dial window start</Label>
              <DateTimePicker
                granularity="time"
                value={schedule.window_start ?? ""}
                onChange={(v) => patch({ window_start: v || null })}
                placeholder="9:00 AM"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dial window end</Label>
              <DateTimePicker
                granularity="time"
                value={schedule.window_end ?? ""}
                onChange={(v) => patch({ window_end: v || null })}
                placeholder="6:00 PM"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Timezone: {schedule.timezone}. If the max-calls limit is hit, or the dial window closes, the
            campaign pauses automatically — calls already in progress always finish; only calls still
            queued are held back until the next period.
          </p>
        </div>
      )}
    </div>
  );
}
