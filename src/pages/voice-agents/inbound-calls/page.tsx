"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { AvailabilityFields } from "@/components/voice-agents/inbound-availability";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { flagForNumber } from "@/lib/country-flag";
import { listVoiceAgents } from "@/lib/api/voice/agents";
import {
  createInboundDeployment,
  deleteInboundDeployment,
  listInboundDeployments,
  updateInboundDeployment,
  availabilitySummary,
  defaultInboundAvailability,
  type InboundAvailability,
  type VoiceInboundDeployment,
} from "@/lib/api/voice/inbound";
import { listPhoneNumbers, type VoicePhoneNumber } from "@/lib/api/voice/telephony";
import type { VoiceAgent } from "@/lib/api/voice/types";

const STEPS = ["Agent", "Availability", "Review & Deploy"] as const;
const INBOUND_COLS = "grid-cols-[minmax(0,1.1fr)_minmax(9rem,1fr)_minmax(0,1.3fr)_5.5rem]";

function isLiveStatus(status: string) {
  return status !== "paused";
}

function liveChip(status: string) {
  return isLiveStatus(status) ? { status: "live", label: "Live" } : { status: "paused", label: "Paused" };
}

export default function VoiceAgentsInboundPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<VoiceInboundDeployment | null>(null);
  const [toDelete, setToDelete] = useState<VoiceInboundDeployment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deployments, setDeployments] = useState<VoiceInboundDeployment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    listInboundDeployments()
      .then(setDeployments)
      .catch(() => setDeployments([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Inbound calls · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  return (
    <div className="voice-page flex flex-col">
      <VoicePageHeader
        title="Inbound calls"
        actions={
          deployments.length > 0 ? (
            <Button className="group/nav rounded-full" onClick={() => setOpen(true)}>
              <KupeIcon name="plus" className="size-4" />
              Create inbound
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <VoiceTableShimmer rows={4} />
      ) : deployments.length === 0 ? (
        <AsciiEmptyState
          kind="incoming"
          tone="emerald"
          title="Answer inbound calls automatically"
          description="Connect a number, assign an agent, answer calls."
          className="min-h-[65vh]"
          actions={
            <>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate("/deploy-with-code/apis/inbound-deployments")}
              >
                Build with API →
              </Button>
              <Button className="group/nav rounded-full" onClick={() => setOpen(true)}>
                <KupeIcon name="plus" className="size-4" />
                Create inbound
              </Button>
            </>
          }
        />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <div className={`grid ${INBOUND_COLS} items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground`}>
            <span>Name</span>
            <span>Number</span>
            <span>Hours</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {deployments.map((d) => {
              const chip = liveChip(d.status);
              return (
                <QuickContextMenu
                  key={d.id}
                  title={d.name}
                  items={[
                    {
                      label: "Copy number",
                      icon: Copy,
                      disabled: !d.from_number,
                      onSelect: () => {
                        void navigator.clipboard.writeText(d.from_number);
                        toast.message("Number copied");
                      },
                    },
                    isLiveStatus(d.status)
                      ? {
                          label: "Pause",
                          icon: Pause,
                          onSelect: () => {
                            void updateInboundDeployment(d.id, { status: "paused" }).then(refresh);
                          },
                        }
                      : {
                          label: "Go live",
                          icon: Play,
                          onSelect: () => {
                            void updateInboundDeployment(d.id, { status: "active" }).then(refresh);
                          },
                        },
                    { type: "separator" },
                    {
                      label: "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      onSelect: () => setToDelete(d),
                    },
                  ]}
                >
                  <li
                    className={`grid cursor-pointer ${INBOUND_COLS} items-center gap-3 px-4 py-3 hover:bg-muted/40`}
                    onClick={() => setSelected(d)}
                  >
                    <span className="truncate text-sm font-medium">{d.name}</span>
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-sm">
                      {d.from_number ? (
                        <>
                          <span aria-hidden>{flagForNumber(d.from_number)}</span>
                          <span className="truncate">{d.from_number}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{availabilitySummary(d.availability)}</p>
                      {isLiveStatus(d.status) ? (
                        <p className="text-xs text-muted-foreground">{d.open_now ? "Open now" : "Outside hours"}</p>
                      ) : null}
                    </div>
                    <StatusChip status={chip.status}>{chip.label}</StatusChip>
                  </li>
                </QuickContextMenu>
              );
            })}
          </ul>
        </div>
      )}

      <CreateInboundDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
      <ManageInboundDialog
        deployment={selected}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        onSaved={(row) => {
          setSelected(row);
          refresh();
        }}
        onDelete={(row) => setToDelete(row)}
      />
      <AlertDialog open={!!toDelete} onOpenChange={(next) => !next && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inbound?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `${toDelete.name}${toDelete.from_number ? ` on ${toDelete.from_number}` : ""} will stop answering calls.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={deleting}
              onClick={() => {
                if (!toDelete) return;
                setDeleting(true);
                void deleteInboundDeployment(toDelete.id)
                  .then(() => {
                    toast.message("Inbound deleted");
                    setToDelete(null);
                    setSelected(null);
                    refresh();
                  })
                  .catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Couldn't delete inbound");
                  })
                  .finally(() => setDeleting(false));
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateInboundDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [connection, setConnection] = useState("");
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [numbers, setNumbers] = useState<VoicePhoneNumber[]>([]);
  const [availability, setAvailability] = useState<InboundAvailability>(defaultInboundAvailability);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setName("");
      setAgentId("");
      setConnection("");
      setAvailability(defaultInboundAvailability());
      listVoiceAgents({ page_size: 100 }).then((res) => setAgents(res.items)).catch(() => setAgents([]));
      listPhoneNumbers().then((rows) => setNumbers(rows.filter((n) => n.status === "active"))).catch(() => setNumbers([]));
    }
  }, [open]);

  function next() {
    if (step === 0) {
      if (!name.trim() || !agentId) {
        toast.message("Fill required fields");
        return;
      }
      if (!connection) {
        toast.message("Select a connection");
        return;
      }
    }
    if (step === 1 && !availability.always && availability.days_of_week.length === 0) {
      toast.message("Select at least one day");
      return;
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    void deploy();
  }

  async function deploy() {
    setSubmitting(true);
    try {
      await createInboundDeployment({
        name: name.trim(),
        agent_id: agentId,
        phone_number_id: connection,
        availability,
      });
      toast.success("Inbound is live");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create inbound deployment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Create inbound</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex gap-4 border-b border-border">
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
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter deployment name" />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Select agent <span className="text-destructive">*</span>
                </Label>
                <Select value={agentId} onValueChange={setAgentId}>
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
                <div className="mt-1.5 space-y-1.5">
                  <Select value={connection} onValueChange={setConnection}>
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

          {step === 1 ? <AvailabilityFields value={availability} onChange={setAvailability} /> : null}

          {step === 2 ? (
            <div className="space-y-3 py-4 text-sm">
              <p className="font-medium">Review & Deploy</p>
              <dl className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                <Row label="Name" value={name || "—"} />
                <Row label="Agent" value={agents.find((a) => a.id === agentId)?.name || "—"} />
                <Row label="Connection" value={numbers.find((n) => n.id === connection)?.e164_number || "—"} />
                <Row label="Hours" value={availabilitySummary(availability)} />
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
            <Button className="rounded-full" onClick={next} disabled={submitting}>
              {step === STEPS.length - 1 ? (submitting ? "Deploying…" : "Deploy") : "Next"}
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

function ManageInboundDialog({
  deployment,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  deployment: VoiceInboundDeployment | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: VoiceInboundDeployment) => void;
  onDelete: (row: VoiceInboundDeployment) => void;
}) {
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [live, setLive] = useState(true);
  const [availability, setAvailability] = useState<InboundAvailability>(defaultInboundAvailability);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deployment) return;
    setName(deployment.name);
    setAgentId(deployment.agent_id);
    setLive(isLiveStatus(deployment.status));
    setAvailability(deployment.availability);
    listVoiceAgents({ page_size: 100 })
      .then((res) => setAgents(res.items))
      .catch(() => setAgents([]));
  }, [deployment]);

  async function save() {
    if (!deployment) return;
    if (!name.trim() || !agentId) {
      toast.message("Fill required fields");
      return;
    }
    if (!availability.always && availability.days_of_week.length === 0) {
      toast.message("Select at least one day");
      return;
    }
    setSaving(true);
    try {
      const row = await updateInboundDeployment(deployment.id, {
        name: name.trim(),
        agent_id: agentId,
        status: live ? "active" : "paused",
        availability,
      });
      toast.success("Inbound updated");
      onSaved(row);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update inbound");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(deployment)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>{deployment?.name || "Inbound"}</DialogTitle>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Number</p>
            <p className="mt-1 flex items-center gap-2 font-mono text-sm">
              {deployment?.from_number ? (
                <>
                  <span aria-hidden>{flagForNumber(deployment.from_number)}</span>
                  {deployment.from_number}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
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

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Live</p>
              <p className="text-xs text-muted-foreground">Answer inbound calls on this number.</p>
            </div>
            <Switch
              checked={live}
              onCheckedChange={setLive}
              className="data-checked:bg-primary"
            />
          </label>

          <AvailabilityFields value={availability} onChange={setAvailability} />
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={() => {
              if (deployment) onDelete(deployment);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
