"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Pause, Play, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { useSession } from "@/context/session-context";
import { listVoiceAgents } from "@/lib/api/voice/agents";
import {
  createCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  uploadCampaignCohort,
  type VoiceCampaign,
} from "@/lib/api/voice/campaigns";
import { listPhoneNumbers, type VoicePhoneNumber } from "@/lib/api/voice/telephony";
import type { VoiceAgent } from "@/lib/api/voice/types";

const STEPS = ["Agent", "Recipients", "Schedule", "Review & Launch"] as const;

export default function VoiceAgentsOutboundPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    listCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Outbound campaigns · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  return (
    <div className="voice-page flex flex-col">
      <VoicePageHeader
        title="Outbound campaigns"
        actions={
          campaigns.length > 0 ? (
            <Button className="rounded-full" onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Create campaign
            </Button>
          ) : undefined
        }
      />

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
                onClick={() => navigate("/voice-agents/deploy-with-code/apis/batch-outbound")}
              >
                Build with API →
              </Button>
              <Button className="rounded-full" onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Create campaign
              </Button>
            </>
          }
        />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Campaign</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {campaigns.map((c) => (
              <QuickContextMenu
                key={c.id}
                title={c.name}
                items={[
                  {
                    label: "Copy name",
                    icon: Copy,
                    onSelect: () => {
                      void navigator.clipboard.writeText(c.name);
                      toast.message("Name copied");
                    },
                  },
                  c.status === "paused" || c.status === "draft"
                    ? {
                        label: "Resume",
                        icon: Play,
                        onSelect: () => {
                          void resumeCampaign(c.id)
                            .then(() => {
                              toast.message("Campaign resumed");
                              refresh();
                            })
                            .catch(() => toast.error("Couldn't resume campaign"));
                        },
                      }
                    : {
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
                      },
                ]}
              >
                <li className="grid cursor-context-menu grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <StatusChip status={c.status} />
                </li>
              </QuickContextMenu>
            ))}
          </ul>
        </div>
      )}

      <ScheduleCampaignDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
    </div>
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
  const [cohortFile, setCohortFile] = useState<File | null>(null);
  const [cohortRows, setCohortRows] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setName("");
      setAgentId("");
      setConnection("");
      setCampaignId(null);
      setCohortFile(null);
      setCohortRows(null);
      listVoiceAgents({ page_size: 100 }).then((res) => setAgents(res.items)).catch(() => setAgents([]));
      listPhoneNumbers().then((rows) => setNumbers(rows.filter((n) => n.status === "active"))).catch(() => setNumbers([]));
    }
  }, [open]);

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
            connection_config: { phone_number_id: connection, sip_trunk_id: numbers.find((n) => n.id === connection)?.sip_trunk_id },
          });
          setCampaignId(campaign.id);
        } catch {
          toast.error("Couldn't create campaign");
          return;
        }
      }
    }
    if (step === 1 && campaignId && cohortFile && cohortRows === null) {
      try {
        const cohort = (await uploadCampaignCohort(campaignId, cohortFile)) as { row_count: number };
        setCohortRows(cohort.row_count);
      } catch {
        toast.error("Couldn't upload recipients");
        return;
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
    setSubmitting(true);
    try {
      await resumeCampaign(campaignId);
      toast.success("Campaign launched");
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't launch campaign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Schedule campaign</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-wrap gap-3 border-b border-border sm:gap-4">
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

        <div className="mt-5 min-h-[260px] space-y-4">
          {step === 0 ? (
            <>
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
            </>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3 py-4 text-sm">
              <p className="font-medium">Recipients</p>
              <p className="text-muted-foreground">Upload a CSV with a "phone" column (extra columns become call variables).</p>
              <button
                type="button"
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-muted-foreground hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-5" />
                {cohortRows !== null
                  ? `${cohortFile?.name} · ${cohortRows} rows uploaded`
                  : cohortFile
                    ? cohortFile.name
                    : "Click to choose a CSV file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  setCohortFile(e.target.files?.[0] ?? null);
                  setCohortRows(null);
                }}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3 py-4 text-sm">
              <p className="font-medium">Schedule</p>
              <p className="text-muted-foreground">Campaign dials sequentially starting immediately on launch.</p>
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">Start now · dial window 9:00–18:00 Asia/Kolkata</div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 py-4 text-sm">
              <p className="font-medium">Review & Launch</p>
              <dl className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                <Row label="Campaign" value={name || "—"} />
                <Row label="Agent" value={agents.find((a) => a.id === agentId)?.name || "—"} />
                <Row label="Connection" value={numbers.find((n) => n.id === connection)?.e164_number || "—"} />
                <Row label="Recipients" value={cohortRows !== null ? `${cohortRows} contacts` : "—"} />
              </dl>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
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
            <Button className="rounded-full" onClick={() => void next()} disabled={submitting || (step === 1 && !cohortFile)}>
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
