"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { QuickContextMenu } from "@/components/quick-context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  createNamedRecipientList,
  listRecipientLists,
  saveRecipientsToList,
  type RecipientList,
} from "@/lib/api/voice/campaigns";
import { analyzeRecipients } from "@/lib/parse-recipients-csv";
import { RecipientsStep, createEmptyRecipientsState, type RecipientsState } from "./recipients-step";

export function PeopleListsPanel({ createOpen, onCreateOpenChange }: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const [lists, setLists] = useState<RecipientList[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<RecipientList | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recipients, setRecipients] = useState<RecipientsState>(() => {
    const s = createEmptyRecipientsState();
    return { ...s, mode: "new" };
  });
  const [submitting, setSubmitting] = useState(false);
  const people = analyzeRecipients(recipients.columns, recipients.rows).people;

  const refresh = useCallback(() => {
    setLoading(true);
    listRecipientLists({ limit: 100 })
      .then((page) => setLists(page.items))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (createOpen) {
      const s = createEmptyRecipientsState();
      setRecipients({ ...s, mode: "new" });
    }
  }, [createOpen]);

  async function createList() {
    if (!recipients.listName.trim()) {
      toast.message("Name this people list");
      return;
    }
    if (people === 0) {
      toast.message("Add at least one recipient with a phone number");
      return;
    }
    setSubmitting(true);
    try {
      const list = await createNamedRecipientList(recipients.listName.trim());
      await saveRecipientsToList(list.id, recipients.columns, recipients.rows);
      toast.message("People list saved");
      onCreateOpenChange(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save people list");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await api.deleteRecipientList(toDelete.id);
      setLists((prev) => prev.filter((l) => l.id !== toDelete.id));
      toast.message("People list deleted");
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete list");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <VoiceTableShimmer rows={4} />;
  }

  if (lists.length === 0) {
    return (
      <>
        <AsciiEmptyState
          kind="campaign"
          tone="coral"
          title="Reusable people lists"
          description="Upload contacts once, then attach the same batch to any campaign."
          className="min-h-[50vh]"
          actions={
            <Button className="group/nav rounded-full" onClick={() => onCreateOpenChange(true)}>
              <KupeIcon name="plus" className="size-4" />
              Create people list
            </Button>
          }
        />
        <CreatePeopleDialog
          open={createOpen}
          onOpenChange={onCreateOpenChange}
          recipients={recipients}
          onRecipientsChange={setRecipients}
          submitting={submitting}
          onSubmit={() => void createList()}
        />
      </>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_7rem_9rem] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span>List</span>
          <span className="text-center">Members</span>
          <span className="text-center">Updated</span>
        </div>
        <ul className="divide-y divide-border">
          {lists.map((list) => (
            <QuickContextMenu
              key={list.id}
              title={list.name}
              items={[
                {
                  label: "Delete",
                  icon: Trash2,
                  variant: "destructive",
                  onSelect: () => setToDelete(list),
                },
              ]}
            >
              <li className="grid grid-cols-[1fr_7rem_9rem] items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{list.name}</p>
                  {list.description ? (
                    <p className="truncate text-xs text-muted-foreground">{list.description}</p>
                  ) : null}
                </div>
                <span className="text-center tabular-nums text-sm text-muted-foreground">
                  {list.member_count.toLocaleString()}
                </span>
                <span className="text-center text-xs text-muted-foreground">
                  {new Date(list.updated_at).toLocaleDateString()}
                </span>
              </li>
            </QuickContextMenu>
          ))}
        </ul>
      </div>

      <CreatePeopleDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        recipients={recipients}
        onRecipientsChange={setRecipients}
        submitting={submitting}
        onSubmit={() => void createList()}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete people list?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" will be removed. Campaigns that used it keep their dial contacts.`
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
    </>
  );
}

function CreatePeopleDialog({
  open,
  onOpenChange,
  recipients,
  onRecipientsChange,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: RecipientsState;
  onRecipientsChange: (next: RecipientsState) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Create people list</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="people-list-name">List name</Label>
            <Input
              id="people-list-name"
              value={recipients.listName}
              onChange={(e) => onRecipientsChange({ ...recipients, listName: e.target.value })}
              placeholder="Q1 leads"
            />
          </div>
          <RecipientsStep
            value={{ ...recipients, mode: "new" }}
            onChange={(next) => onRecipientsChange({ ...next, mode: "new" })}
            hideModeToggle
            hideListName
          />
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Save list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
