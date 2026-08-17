"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { revertVoiceAgent } from "@/lib/api/voice/agents";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

export type VersionHistoryEntry = {
  version: number;
  label: string | null;
  message: string | null;
  created_at: string;
  snapshot: Record<string, unknown>;
};

export function VersionHistoryPanel({
  agentId,
  entry,
  onOpenChange,
  onReverted,
}: {
  agentId: string;
  entry: VersionHistoryEntry | null;
  onOpenChange: (open: boolean) => void;
  onReverted: () => void;
}) {
  const [reverting, setReverting] = useState(false);
  const snapshot = entry?.snapshot ?? {};

  async function revert() {
    if (!entry) return;
    setReverting(true);
    try {
      await revertVoiceAgent(agentId, entry.version);
      toast.success(`Reverted to v${entry.version}`);
      onOpenChange(false);
      onReverted();
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't revert agent"));
    } finally {
      setReverting(false);
    }
  }

  return (
    <Sheet open={!!entry} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            v{entry?.version}
          </SheetTitle>
          <SheetDescription>
            {entry ? new Date(entry.created_at).toLocaleString() : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          {entry?.message ? (
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm">{entry.message}</div>
          ) : null}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Name</p>
            <p className="text-sm">{String(snapshot.name ?? "—")}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">First message</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {String(snapshot.greeting ?? "—")}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">System prompt</p>
            <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {String(snapshot.system_prompt ?? "—")}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void revert()} disabled={reverting}>
            {reverting ? "Reverting…" : "Revert to this version"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
