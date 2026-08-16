"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { RenameDialog } from "@/components/rename-dialog";
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
import { listVoiceAgents } from "@/lib/api/voice/agents";
import { createInboundDeployment, deleteInboundDeployment, listInboundDeployments, updateInboundDeployment, type VoiceInboundDeployment } from "@/lib/api/voice/inbound";
import { listPhoneNumbers, type VoicePhoneNumber } from "@/lib/api/voice/telephony";
import type { VoiceAgent } from "@/lib/api/voice/types";

const STEPS = ["Agent", "Availability", "Review & Deploy"] as const;

export default function VoiceAgentsInboundPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<VoiceInboundDeployment | null>(null);
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
            <Button className="rounded-full" onClick={() => setOpen(true)}>
              <Plus className="size-4" />
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
              <Button className="rounded-full" onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Create inbound
              </Button>
            </>
          }
        />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Name</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {deployments.map((d) => (
              <QuickContextMenu
                key={d.id}
                title={d.name}
                items={[
                  {
                    label: "Copy name",
                    icon: Copy,
                    onSelect: () => {
                      void navigator.clipboard.writeText(d.name);
                      toast.message("Name copied");
                    },
                  },
                  { label: "Rename", icon: Pencil, onSelect: () => setRenaming(d) },
                  d.status === "paused" || d.status === "draft"
                    ? {
                        label: "Activate",
                        icon: Play,
                        onSelect: () => {
                          void updateInboundDeployment(d.id, { status: "active" }).then(refresh);
                        },
                      }
                    : {
                        label: "Pause",
                        icon: Pause,
                        onSelect: () => {
                          void updateInboundDeployment(d.id, { status: "paused" }).then(refresh);
                        },
                      },
                  { type: "separator" },
                  {
                    label: "Delete",
                    icon: Trash2,
                    variant: "destructive",
                    onSelect: () => {
                      void deleteInboundDeployment(d.id).then(() => {
                        toast.message("Inbound deleted");
                        refresh();
                      });
                    },
                  },
                ]}
              >
                <li className="grid cursor-context-menu grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="truncate text-sm font-medium">{d.name}</span>
                  <StatusChip status={d.status} />
                  <span />
                </li>
              </QuickContextMenu>
            ))}
          </ul>
        </div>
      )}

      <CreateInboundDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
      <RenameDialog
        open={Boolean(renaming)}
        onOpenChange={(next) => {
          if (!next) setRenaming(null);
        }}
        title="Rename inbound"
        initial={renaming?.name ?? ""}
        onSubmit={async (name) => {
          if (!renaming) return;
          await updateInboundDeployment(renaming.id, { name });
          setRenaming(null);
          toast.message("Inbound renamed");
          refresh();
        }}
      />
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setName("");
      setAgentId("");
      setConnection("");
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
        availability: { hours: "24/7", timezone: "Asia/Kolkata" },
      });
      toast.success("Inbound deployment created");
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create inbound deployment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-xl" showCloseButton>
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

          {step === 1 ? (
            <div className="space-y-3 py-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Availability</p>
              <p>Defaults to 24/7 — configurable hours ship in a later release.</p>
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground">
                Always available · timezone Asia/Kolkata
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3 py-4 text-sm">
              <p className="font-medium">Review & Deploy</p>
              <dl className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                <Row label="Name" value={name || "—"} />
                <Row label="Agent" value={agents.find((a) => a.id === agentId)?.name || "—"} />
                <Row label="Connection" value={numbers.find((n) => n.id === connection)?.e164_number || "—"} />
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
