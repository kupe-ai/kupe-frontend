"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { AddNumberDialog } from "@/components/voice-agents/add-number-dialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
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
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { TelephonyAccount } from "@/types";

export default function VoiceAgentsPhoneNumbersPage() {
  const [numbers, setNumbers] = useState<TelephonyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
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
        <h1 className="text-display">Phone numbers</h1>
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
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Number</span>
            <span>Provider</span>
            <span>Source</span>
            <span>Monthly rent</span>
            <span className="w-8" />
          </div>
          <ul className="divide-y divide-border">
            {numbers.map((n) => (
              <QuickContextMenu
                key={n.id}
                title={n.from_number}
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
                <li className="grid cursor-context-menu grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="font-mono text-sm">{n.from_number}</span>
                  <span className="text-sm capitalize text-muted-foreground">{n.provider}</span>
                  <StatusChip status={n.managed_by_kupe ? "active" : "info"}>
                    {n.managed_by_kupe ? "Kupe managed" : "Your own"}
                  </StatusChip>
                  <span className="text-sm text-muted-foreground">
                    {n.managed_by_kupe && n.monthly_rent_minor_units
                      ? `₹${(n.monthly_rent_minor_units / 100).toFixed(0)}/mo`
                      : "—"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${n.from_number}`}
                    onClick={() => setToDelete(n)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              </QuickContextMenu>
            ))}
          </ul>
        </div>
      )}

      <AddNumberDialog open={addOpen} onOpenChange={setAddOpen} orgId={orgId} onDone={refresh} />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete?.managed_by_kupe ? "Release" : "Remove"} “{toDelete?.from_number}”?
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
