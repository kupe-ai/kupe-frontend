"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CircleAlert, ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { usePlivoUccOptional } from "@/context/plivo-ucc-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PlivoUccComplaintOut, PlivoUccStatus, TelephonyAccount } from "@/types";

const UCC_COLS =
  "grid-cols-[4.75rem_4.5rem_5.5rem_minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_5.5rem_5.75rem_5.5rem_auto]";

/** Shorten long ids so the action column stays visible. */
function ellipsize(value: string | null | undefined, head = 8): string {
  if (!value) return "—";
  if (value.length <= head) return value;
  return `${value.slice(0, head)}…`;
}

const STATUS_FILTERS: { value: "" | PlivoUccStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In review" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PROOF_ACCEPT = "application/pdf,image/png,image/jpeg";
const PROOF_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

const CHECKLIST = [
  { id: "logo", label: "Business logo is visible on the proof" },
  { id: "date", label: "Opt-in date is within the last 6 months" },
  { id: "number", label: "Complainant’s number is on the proof" },
] as const;

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.length >= 10 ? iso.slice(0, 10) : "—";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isOverdue(iso: string | null | undefined, status: PlivoUccStatus): boolean {
  if (!iso || (status !== "pending" && status !== "rejected")) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function proofActionLabel(status: PlivoUccStatus): string | null {
  if (status === "pending") return "Upload proof";
  if (status === "rejected") return "Re-upload";
  return null;
}

export function UccPanel({ orgId, numbers }: { orgId: string; numbers: TelephonyAccount[] }) {
  const ucc = usePlivoUccOptional();
  const [items, setItems] = useState<PlivoUccComplaintOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | PlivoUccStatus>("");
  const [uploading, setUploading] = useState<PlivoUccComplaintOut | null>(null);

  const hasIndiaPlivo = numbers.some((n) => n.provider === "plivo" && n.country_iso === "IN");

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listPlivoUcc(orgId, statusFilter ? { status: statusFilter } : undefined)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [orgId, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onProofSubmitted(updated: PlivoUccComplaintOut) {
    setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setUploading(null);
    toast.success("Proof submitted");
    await ucc?.refresh();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              statusFilter === f.value
                ? "kupe-chip-active"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <VoiceTableShimmer rows={4} />
      ) : items.length === 0 ? (
        <AsciiEmptyState
          kind="phone"
          tone="coral"
          title={hasIndiaPlivo ? "No UCC complaints" : "No India Plivo numbers"}
          description={
            hasIndiaPlivo
              ? "When a TRAI complaint is filed against a call, it shows up here. You have 5 business days to upload opt-in proof."
              : "UCC applies to India landline and 160-series numbers on Plivo. Buy or connect an India number first."
          }
          className="min-h-[240px]"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <div
            className={`grid min-w-[52rem] ${UCC_COLS} items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground`}
          >
            <span>Reference</span>
            <span>Call UUID</span>
            <span>Date of call</span>
            <span>From</span>
            <span>Complainant</span>
            <span>Complaint date</span>
            <span>Deadline</span>
            <span>Status</span>
            <span className="w-full" />
          </div>
          <ul className="min-w-[52rem] divide-y divide-border">
            {items.map((row) => {
              const overdue = isOverdue(row.deadline_at, row.status);
              const action = proofActionLabel(row.status);
              return (
                <li
                  key={row.id}
                  role={action ? "button" : undefined}
                  tabIndex={action ? 0 : undefined}
                  onClick={() => {
                    if (action) setUploading(row);
                  }}
                  onKeyDown={(e) => {
                    if (!action) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setUploading(row);
                    }
                  }}
                  className={cn(
                    `grid ${UCC_COLS} items-center gap-2 px-4 py-3`,
                    action && "cursor-pointer hover:bg-muted/40",
                  )}
                >
                  <span className="truncate font-mono text-sm" title={row.reference_id}>
                    {ellipsize(row.reference_id, 10)}
                  </span>
                  <span
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={row.call_uuid ?? undefined}
                  >
                    {ellipsize(row.call_uuid, 8)}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDay(row.initiation_date)}
                  </span>
                  <span className="truncate font-mono text-sm" title={row.from_number}>
                    {row.from_number}
                  </span>
                  <span className="truncate font-mono text-sm" title={row.to_number}>
                    {row.to_number}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDay(row.created_at)}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-sm tabular-nums",
                      overdue ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {overdue ? <CircleAlert className="size-3.5 shrink-0" /> : null}
                    {formatDay(row.deadline_at)}
                  </span>
                  <span className="justify-self-start">
                    <StatusChip status={row.status} />
                  </span>
                  <span className="justify-self-end shrink-0">
                    {action ? (
                      <Button
                        type="button"
                        variant={row.status === "rejected" ? "destructive" : "outline"}
                        size="sm"
                        className="rounded-full whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploading(row);
                        }}
                      >
                        {row.status === "rejected" ? (
                          <Ban className="size-3.5" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        {action}
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <UccProofDialog
        orgId={orgId}
        complaint={uploading}
        onOpenChange={(open) => {
          if (!open) setUploading(null);
        }}
        onSubmitted={onProofSubmitted}
      />
    </div>
  );
}

function UccProofDialog({
  orgId,
  complaint,
  onOpenChange,
  onSubmitted,
}: {
  orgId: string;
  complaint: PlivoUccComplaintOut | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (row: PlivoUccComplaintOut) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (complaint) {
      setFile(null);
      setChecks({});
    }
  }, [complaint]);

  const allChecked = CHECKLIST.every((c) => checks[c.id]);
  const canSubmit = Boolean(file) && allChecked && !submitting;

  function onFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > PROOF_MAX_BYTES) {
      toast.error("File must be 10 MB or smaller");
      return;
    }
    if (next.type && !PROOF_TYPES.has(next.type)) {
      toast.error("Use a PDF, PNG, or JPEG");
      return;
    }
    setFile(next);
  }

  async function submit() {
    if (!complaint || !file || !canSubmit) return;
    setSubmitting(true);
    try {
      const row = await api.submitPlivoUccProof(orgId, complaint.reference_id, file);
      onSubmitted(row);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit proof");
    } finally {
      setSubmitting(false);
    }
  }

  const rejected = complaint?.status === "rejected";

  return (
    <Dialog open={Boolean(complaint)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{rejected ? "Re-upload opt-in proof" : "Upload opt-in proof"}</DialogTitle>
          <DialogDescription>
            PDF, PNG, or JPEG up to 10 MB. Plivo reviews this against the complainant’s number.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          {rejected && complaint?.rejection_reason ? (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <Ban className="mt-0.5 size-4 shrink-0" />
              <p>{complaint.rejection_reason}</p>
            </div>
          ) : null}

          {complaint ? (
            <p className="text-xs text-muted-foreground">
              {complaint.reference_id}
              {" · "}
              complainant {complaint.to_number}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>Proof file</Label>
            <label
              className={cn(
                "pressable flex min-h-[9.5rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-center transition-colors hover:bg-muted/40",
                file && "border-solid bg-muted/20",
              )}
            >
              {file ? (
                <>
                  <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
                    {file.type.startsWith("image/") ? (
                      <ImageIcon className="size-5 text-foreground" />
                    ) : (
                      <Upload className="size-5 text-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 max-w-full">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB · click to replace
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-full max-w-[13.5rem] overflow-hidden rounded-lg border border-border bg-background shadow-sm"
                    aria-hidden
                  >
                    <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-2 py-1.5">
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                      <span className="ml-1 truncate font-mono text-[9px] text-muted-foreground">
                        CRM · opt-in record
                      </span>
                    </div>
                    <div className="space-y-1.5 p-2.5">
                      <div className="h-1.5 w-2/5 rounded-full bg-primary/35" />
                      <div className="h-1.5 w-4/5 rounded-full bg-muted-foreground/20" />
                      <div className="h-1.5 w-3/5 rounded-full bg-muted-foreground/20" />
                      <div className="mt-1 flex items-center justify-between rounded-md bg-muted/60 px-2 py-1.5">
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {complaint?.to_number ?? "+91…"}
                        </span>
                        <span className="text-[9px] font-medium text-primary">Opted in</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Add a CRM screenshot or export</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      PDF, PNG, or JPEG · up to 10 MB
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    <Upload className="size-3.5" />
                    Choose file
                  </span>
                </>
              )}
              <input
                type="file"
                accept={PROOF_ACCEPT}
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Confirm the proof includes</p>
            {CHECKLIST.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={Boolean(checks[item.id])}
                  onCheckedChange={(checked) =>
                    setChecks((prev) => ({ ...prev, [item.id]: checked === true }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? "Uploading…" : rejected ? "Re-upload" : "Submit proof"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
