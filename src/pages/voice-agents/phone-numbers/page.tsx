"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { AddNumberDialog } from "@/components/voice-agents/add-number-dialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuickContextMenu } from "@/components/quick-context-menu";
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
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { api } from "@/lib/api";
import { flagForNumber } from "@/lib/country-flag";
import { requireScope } from "@/lib/api/workspace-scope";
import type { TelephonyAccount } from "@/types";

const NUMBER_COLS = "grid-cols-[minmax(0,1.1fr)_minmax(9rem,1.2fr)_6.5rem_9rem_7.5rem_2.5rem]";

function numberName(n: Pick<TelephonyAccount, "label" | "from_number"> | null | undefined): string {
  if (!n) return "";
  const label = (n.label || "").trim();
  if (!label || label === n.from_number || label === `Plivo ${n.from_number}`) return "";
  return label;
}

export default function VoiceAgentsPhoneNumbersPage() {
  const [numbers, setNumbers] = useState<TelephonyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<TelephonyAccount | null>(null);
  const [toDelete, setToDelete] = useState<TelephonyAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    const { orgId } = requireScope();
    api
      .listTelephonyAccounts(orgId)
      .then(setNumbers)
      .catch(() => setNumbers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Phone numbers · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await api.deleteTelephonyAccount(toDelete.id);
      setNumbers((prev) => prev.filter((n) => n.id !== toDelete.id));
      toast.message(toDelete.managed_by_kupe ? "Number released" : "Number removed");
      setToDelete(null);
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this number");
    } finally {
      setDeleting(false);
    }
  }

  const { orgId } = requireScope();

  return (
    <div className="voice-page voice-page-md">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title">Phone numbers</h1>
        <Button className="group/nav rounded-full" onClick={() => setAddOpen(true)}>
          <KupeIcon name="plus" className="size-4" />
          Add number
        </Button>
      </div>

      {loading ? (
        <VoiceTableShimmer rows={4} />
      ) : numbers.length === 0 ? (
        <AsciiEmptyState
          kind="phone"
          tone="coral"
          title="Connect your first number"
          description="Bring your own Twilio number, or buy one through Plivo — billed from your Kupe wallet."
          className="min-h-[280px]"
          actions={
            <Button className="group/nav rounded-full" onClick={() => setAddOpen(true)}>
              <KupeIcon name="plus" className="size-4" />
              Add number
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className={`grid ${NUMBER_COLS} items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground`}>
            <span className="text-left">Name</span>
            <span className="text-left">Number</span>
            <span className="text-left">Provider</span>
            <span className="text-left">Source</span>
            <span className="text-left">Monthly rent</span>
            <span className="w-full" />
          </div>
          <ul className="divide-y divide-border">
            {numbers.map((n) => {
              const name = numberName(n);
              return (
                <QuickContextMenu
                  key={n.id}
                  title={name || n.from_number}
                  items={[
                    {
                      label: "Copy number",
                      icon: Copy,
                      onSelect: () => {
                        void navigator.clipboard.writeText(n.from_number);
                        toast.message("Number copied");
                      },
                    },
                    { type: "separator" },
                    {
                      label: n.managed_by_kupe ? "Release number" : "Remove",
                      icon: Trash2,
                      variant: "destructive",
                      onSelect: () => setToDelete(n),
                    },
                  ]}
                >
                  <li
                    className={`grid cursor-pointer ${NUMBER_COLS} items-center gap-3 px-4 py-3 hover:bg-muted/40`}
                    onClick={() => setSelected(n)}
                  >
                    <span className="truncate text-sm font-medium">{name || "—"}</span>
                    <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                      <span aria-hidden>{flagForNumber(n.from_number, n.country_iso)}</span>
                      <span className="truncate">{n.from_number}</span>
                    </span>
                    <span className="text-left text-sm capitalize text-muted-foreground">{n.provider}</span>
                    <span className="justify-self-start">
                      <StatusChip status={n.managed_by_kupe ? "active" : "info"}>
                        {n.managed_by_kupe ? "Kupe managed" : "Your own"}
                      </StatusChip>
                    </span>
                    <span className="text-left text-sm text-muted-foreground">
                      {n.managed_by_kupe && n.monthly_rent_minor_units
                        ? `₹${(n.monthly_rent_minor_units / 100).toFixed(0)}/mo`
                        : "—"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="justify-self-end"
                      aria-label={`Remove ${n.from_number}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(n);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                </QuickContextMenu>
              );
            })}
          </ul>
        </div>
      )}

      <AddNumberDialog open={addOpen} onOpenChange={setAddOpen} orgId={orgId} onDone={refresh} />
      <ManageNumberDialog
        account={selected}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        onSaved={(row) => {
          setNumbers((prev) => prev.map((n) => (n.id === row.id ? row : n)));
          setSelected(null);
        }}
        onDelete={(row) => setToDelete(row)}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete?.managed_by_kupe ? "Release" : "Remove"} “{numberName(toDelete) || toDelete?.from_number}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.managed_by_kupe
                ? "This unrents the number from Plivo immediately — it can't be recovered, and any agent using it stops receiving calls."
                : "Agents using this number stop working immediately. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Working…" : toDelete?.managed_by_kupe ? "Release" : "Remove"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ManageNumberDialog({
  account,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  account: TelephonyAccount | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: TelephonyAccount) => void;
  onDelete: (row: TelephonyAccount) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) setName(numberName(account));
  }, [account]);

  async function save() {
    if (!account) return;
    setSaving(true);
    try {
      const row = await api.patchTelephonyAccount(account.id, { label: name.trim() });
      toast.success("Number updated");
      onSaved(row);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this number");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{numberName(account) || "Phone number"}</DialogTitle>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales line"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Number</p>
            <p className="mt-1 flex items-center gap-2 font-mono text-sm">
              {account ? (
                <>
                  <span aria-hidden>{flagForNumber(account.from_number, account.country_iso)}</span>
                  {account.from_number}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>

          {account ? (
            <dl className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="capitalize font-medium">{account.provider}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-medium">{account.managed_by_kupe ? "Kupe managed" : "Your own"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Monthly rent</dt>
                <dd className="font-medium">
                  {account.managed_by_kupe && account.monthly_rent_minor_units
                    ? `₹${(account.monthly_rent_minor_units / 100).toFixed(0)}/mo`
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={() => {
              if (account) onDelete(account);
            }}
          >
            <Trash2 className="size-3.5" />
            {account?.managed_by_kupe ? "Release" : "Remove"}
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
