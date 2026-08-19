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
import type { RecipientListMember } from "@/types";
import { RecipientsStep, createEmptyRecipientsState, type RecipientsState } from "./recipients-step";

const MEMBERS_PAGE_SIZE = 50;

export function PeopleListsPanel({ createOpen, onCreateOpenChange }: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const [lists, setLists] = useState<RecipientList[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<RecipientList | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<RecipientList | null>(null);
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
    const name = recipients.listName.trim();
    if (lists.some((l) => l.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error("A people list with this name already exists. Pick a different name.");
      return;
    }
    setSubmitting(true);
    try {
      const list = await createNamedRecipientList(name);
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
      if (viewing?.id === toDelete.id) setViewing(null);
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
              <li
                className="grid cursor-pointer grid-cols-[1fr_7rem_9rem] items-center gap-3 px-4 py-3 hover:bg-muted/40"
                onClick={() => setViewing(list)}
              >
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

      <ViewPeopleListDialog list={viewing} onOpenChange={(o) => !o && setViewing(null)} />

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
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
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

function ViewPeopleListDialog({
  list,
  onOpenChange,
}: {
  list: RecipientList | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [members, setMembers] = useState<RecipientListMember[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [loading, setLoading] = useState(false);

  const loadPage = useCallback(
    async (cursor: string | null, replaceStack = false) => {
      if (!list) return;
      setLoading(true);
      try {
        const page = await api.listRecipientListMembers(list.id, {
          limit: MEMBERS_PAGE_SIZE,
          cursor: cursor ?? undefined,
        });
        setMembers(page.items);
        setTotal(page.total);
        setNextCursor(page.next_cursor);
        if (replaceStack) setCursorStack([null]);
      } catch {
        toast.error("Couldn't load members");
        setMembers([]);
        setTotal(0);
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    },
    [list],
  );

  useEffect(() => {
    if (list) void loadPage(null, true);
    else {
      setMembers([]);
      setTotal(0);
      setNextCursor(null);
      setCursorStack([null]);
    }
  }, [list, loadPage]);

  const variableKeys = (() => {
    const keys = new Set<string>();
    for (const m of members) {
      for (const k of Object.keys(m.variables ?? {})) keys.add(k);
    }
    return Array.from(keys).slice(0, 4);
  })();

  return (
    <Dialog open={!!list} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{list?.name ?? "People list"}</DialogTitle>
          {list ? (
            <p className="text-sm text-muted-foreground">
              {list.member_count.toLocaleString()}{" "}
              {list.member_count === 1 ? "member" : "members"}
              {list.description ? ` · ${list.description}` : ""}
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <div
              className="grid gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground"
              style={{
                gridTemplateColumns: `minmax(0,1.2fr) ${variableKeys.map(() => "minmax(0,1fr)").join(" ")}`.trim(),
              }}
            >
              <span>Phone</span>
              {variableKeys.map((k) => (
                <span key={k} className="truncate">
                  {k}
                </span>
              ))}
            </div>
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : members.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No members yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="grid items-center gap-3 px-4 py-2.5 text-sm"
                    style={{
                      gridTemplateColumns: `minmax(0,1.2fr) ${variableKeys.map(() => "minmax(0,1fr)").join(" ")}`.trim(),
                    }}
                  >
                    <span className="truncate font-mono text-[13px]">{m.phone_number}</span>
                    {variableKeys.map((k) => (
                      <span key={k} className="truncate text-muted-foreground">
                        {m.variables?.[k] != null && String(m.variables[k]) !== ""
                          ? String(m.variables[k])
                          : "—"}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {members.length ? members.length : 0} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || cursorStack.length <= 1}
                onClick={() => {
                  const stack = cursorStack.slice(0, -1);
                  const prev = stack[stack.length - 1] ?? null;
                  setCursorStack(stack);
                  void loadPage(prev);
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !nextCursor}
                onClick={() => {
                  if (!nextCursor) return;
                  setCursorStack((s) => [...s, nextCursor]);
                  void loadPage(nextCursor);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
