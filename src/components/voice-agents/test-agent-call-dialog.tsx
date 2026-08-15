"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { PetSprite } from "@/components/pets/pet-sprite";
import { AgentVoiceVisualizer } from "@/components/voice-agents/agent-voice-visualizer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { startWebCall, webCallErrorMessage, type WebCallHandle, type WebCallStatus } from "@/lib/voice/livekit-web-call";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

/**
 * Real browser "Test Agent" call — connects the mic to a LiveKit room via
 * POST /v1/calls, plays the agent's synthesized voice back, and shows a
 * live waveform driven by the agent's actual audio amplitude.
 */
export function TestAgentCallDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  seed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  seed: string;
}) {
  const [status, setStatus] = useState<WebCallStatus>("idle");
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const handleRef = useRef<WebCallHandle | null>(null);

  useEffect(() => {
    if (!open) {
      void handleRef.current?.disconnect();
      handleRef.current = null;
      setStatus("idle");
      setLevel(0);
      setMuted(false);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    setErrorMsg(null);
    void startWebCall(agentId, {
      onStatusChange: (s) => !cancelled && setStatus(s),
      onAgentAudioLevel: (l) => !cancelled && setLevel(l),
      onError: (err) => {
        if (cancelled) return;
        const msg = friendlyVoiceError(err, webCallErrorMessage(err));
        setErrorMsg(msg);
        toast.error(msg);
      },
    }).then((handle) => {
      if (cancelled) {
        void handle.disconnect();
        return;
      }
      handleRef.current = handle;
    });

    return () => {
      cancelled = true;
      void handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [open, agentId]);

  function toggleMute() {
    const room = handleRef.current?.room;
    if (!room) return;
    const next = !muted;
    void room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  const statusLabel =
    status === "connecting"
      ? "Connecting…"
      : status === "connected"
        ? "Live"
        : status === "error"
          ? "Couldn't connect"
          : "Call ended";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-sm">
        <DialogTitle className="sr-only">Test call with {agentName}</DialogTitle>
        <div className="flex flex-col items-center gap-5 px-6 py-10 text-center">
          <div className="relative flex size-16 items-center justify-center rounded-2xl bg-muted">
            <PetSprite seed={seed} size={36} frame="stand" />
            {status === "connecting" && (
              <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-background shadow-sm">
                <Loader2 className="size-3.5 animate-spin text-primary" />
              </span>
            )}
            {status === "connected" && (
              <span className="absolute -right-1 -bottom-1 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{agentName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{statusLabel}</p>
            {errorMsg ? (
              <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-destructive">{errorMsg}</p>
            ) : null}
          </div>

          <AgentVoiceVisualizer
            level={level}
            active={status === "connected"}
            processing={status === "connecting"}
          />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={toggleMute}
              disabled={status !== "connected"}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="rounded-full"
              aria-label="End call"
              onClick={() => onOpenChange(false)}
            >
              <PhoneOff className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
