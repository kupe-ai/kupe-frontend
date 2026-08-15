"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Expand,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getInteraction } from "@/lib/api/voice/calls";
import type { VoiceCall, VoiceCallTranscriptTurn } from "@/lib/api/voice/types";

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.message("Copied");
}

export function CallLogDetailDialog({
  callId,
  open,
  onOpenChange,
}: {
  callId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"transcript" | "overview">("overview");
  const [detail, setDetail] = useState<(VoiceCall & { transcript: VoiceCallTranscriptTurn[] }) | null>(null);

  useEffect(() => {
    if (!open || !callId) {
      setDetail(null);
      return;
    }
    getInteraction(callId)
      .then(setDetail)
      .catch(() => {
        toast.error("Couldn't load call details");
        setDetail(null);
      });
  }, [open, callId]);

  if (!callId) return null;

  const interactionInfo = detail
    ? [
        { key: "Call ID", value: detail.id },
        { key: "Direction", value: detail.direction },
        { key: "Channel", value: detail.channel },
        { key: "Status", value: detail.status },
        { key: "Connectivity", value: detail.connectivity ?? "—" },
        { key: "Ended by", value: detail.ended_by ?? "—" },
        { key: "Started at", value: new Date(detail.started_at).toLocaleString() },
        { key: "Duration", value: detail.duration_seconds != null ? `${detail.duration_seconds}s` : "—" },
        { key: "Language", value: detail.language ?? "—" },
        { key: "Messages", value: String(detail.message_count) },
        { key: "User identifier", value: detail.user_identifier ?? "—" },
      ]
    : [];

  const variables = detail ? Object.entries(detail.variables ?? {}) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,840px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">Unified View Details</DialogTitle>

        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Unified View Details</h2>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-mono">{callId}</span>
              <button type="button" onClick={() => copy(callId)}>
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm">
              <Expand className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-border px-5">
          <div className="flex gap-4">
            {(
              [
                ["transcript", "Transcript"],
                ["overview", "Overview"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "border-b-2 py-2.5 text-sm",
                  tab === id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!detail ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tab === "overview" ? (
            <div className="space-y-6">
              <section>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Goal status</p>
                <div className="mt-2">
                  <Badge variant="secondary" className="font-normal capitalize">
                    {detail.goal_status ?? "not_evaluated"}
                  </Badge>
                </div>
              </section>

              {variables.length > 0 && (
                <section>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Call variables</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {variables.map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-muted-foreground">{key}</dt>
                        <dd className="mt-0.5 break-all text-sm">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <section>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Interaction info</p>
                <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {interactionInfo.map((v) => (
                    <div key={v.key}>
                      <dt className="text-xs text-muted-foreground">{v.key}</dt>
                      <dd className="mt-0.5 break-all text-sm">{v.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              {detail.transcript.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No transcript recorded.</p>
              ) : (
                detail.transcript.map((turn, i) => {
                  if (turn.role === "system") {
                    return (
                      <div key={i} className="flex justify-center">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{turn.text}</span>
                      </div>
                    );
                  }
                  const isUser = turn.role === "user";
                  return (
                    <div key={i} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          isUser ? "bg-muted text-foreground" : "border border-border bg-background",
                        )}
                      >
                        {turn.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {tab === "transcript" && detail?.recording_url ? (
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <audio controls src={detail.recording_url} className="w-full" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
