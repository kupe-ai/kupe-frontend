"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { commitVoiceAgentVersion } from "@/lib/api/voice/agents";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

export function CommitAgentDialog({
  agentId,
  open,
  onOpenChange,
  onCommitted,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommitted: (version: number) => void;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function commit() {
    setSaving(true);
    try {
      const result = await commitVoiceAgentVersion(agentId, message.trim() || undefined);
      toast.success(`Committed as v${result.version}`);
      setMessage("");
      onOpenChange(false);
      onCommitted(result.version);
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't commit agent"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">Commit agent</DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>
        <div className="space-y-4 px-5 py-4">
          <DialogDescription className="text-sm text-muted-foreground">
            Saves the agent&apos;s current draft as a new numbered version. Your edits are already
            saved as a draft — committing just marks this point in history so you can come back to
            it later.
          </DialogDescription>
          <div className="space-y-1.5">
            <label htmlFor="commit-message" className="block text-xs text-muted-foreground">
              Commit message — optional
            </label>
            <textarea
              id="commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="e.g. Tightened the greeting, added transfer rules"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full !shadow-none" onClick={() => void commit()} disabled={saving}>
            {saving ? "Committing…" : "Commit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
