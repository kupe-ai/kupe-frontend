"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudioPlayer } from "@/components/ui/audio-player";
import { StatusChip } from "@/components/ui/status-chip";
import { Message, MessageContent } from "@/components/ui/message";
import { cn } from "@/lib/utils";
import { prefetchInteraction, type InteractionDetail } from "@/lib/api/voice/calls";
import type { VoiceCall } from "@/lib/api/voice/types";

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.message("Copied");
}

export function CallLogDetailDialog({
  callId,
  call,
  open,
  onOpenChange,
}: {
  callId: string | null;
  call?: VoiceCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"transcript" | "overview">("overview");
  const [detail, setDetail] = useState<InteractionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !callId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setDetail((prev) => {
      if (prev?.id === callId) return prev;
      if (call && call.id === callId) {
        return { ...call, transcript: [], recording_url: call.recording_url ?? null };
      }
      return null;
    });
    setLoading(true);
    let cancelled = false;
    prefetchInteraction(callId, call ?? undefined)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load call details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, callId, call]);

  if (!callId) return null;

  const interactionInfo: {
    key: string;
    value: string;
    chip?: boolean;
    copy?: boolean;
    truncate?: boolean;
  }[] = detail
    ? [
        { key: "Call ID", value: detail.id, copy: true, truncate: true },
        { key: "Direction", value: detail.direction, chip: true },
        { key: "Channel", value: detail.channel },
        { key: "Status", value: detail.status, chip: true },
        { key: "Connectivity", value: detail.connectivity ?? "—", chip: true },
        { key: "Cause", value: detail.failure_reason ?? "—", chip: true },
        { key: "Ended by", value: detail.ended_by ?? "—", chip: true },
        { key: "Started at", value: new Date(detail.started_at).toLocaleString() },
        { key: "Duration", value: detail.duration_seconds != null ? `${detail.duration_seconds}s` : "—" },
        { key: "Language", value: detail.language ?? "—", chip: true },
        { key: "Messages", value: String(detail.message_count) },
        { key: "User identifier", value: detail.user_identifier ?? "—", copy: Boolean(detail.user_identifier), truncate: true },
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

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Unified View Details</h2>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="min-w-0 truncate font-mono" title={callId}>{callId}</span>
              <button type="button" onClick={() => copy(callId)}>
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-border px-5">
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

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
          {!detail ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tab === "overview" ? (
            <div className="space-y-6">
              <section>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Goal status</p>
                <div className="mt-2">
                  <StatusChip status={detail.goal_status ?? "not_evaluated"} />
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
                    <div key={v.key} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{v.key}</dt>
                      <dd className="mt-0.5 min-w-0 text-sm">
                        {v.chip ? (
                          <StatusChip status={v.value} />
                        ) : v.copy ? (
                          <button
                            type="button"
                            title={v.value}
                            className="inline-flex w-full max-w-[14rem] min-w-0 items-center gap-1"
                            onClick={() => copy(v.value)}
                          >
                            <span className={cn("min-w-0 font-mono text-xs", v.truncate && "truncate")}>{v.value}</span>
                            <Copy className="size-3 shrink-0 text-muted-foreground" />
                          </button>
                        ) : (
                          <span className="break-all">{v.value}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          ) : (
            <div>
              {loading && detail.transcript.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Loading transcript…</p>
              ) : detail.transcript.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No transcript recorded.</p>
              ) : (
                detail.transcript.map((turn, i) => {
                  if (turn.role === "system") {
                    return (
                      <div key={i} className="flex justify-center py-1.5">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{turn.text}</span>
                      </div>
                    );
                  }
                  return (
                    <Message key={i} from={turn.role === "user" ? "user" : "assistant"} className="py-1.5">
                      <MessageContent variant="contained">{turn.text}</MessageContent>
                    </Message>
                  );
                })
              )}
            </div>
          )}
        </div>

        {tab === "transcript" && detail?.recording_url ? (
          <div className="shrink-0 border-t border-border bg-background p-3">
            <AudioPlayer
              src={detail.recording_url}
              autoPlay={false}
              downloadName={`call-${detail.id}.mp3`}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
