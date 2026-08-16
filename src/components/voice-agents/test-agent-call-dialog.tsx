"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, RotateCw } from "lucide-react";
import { RoomEvent, type TranscriptionSegment } from "livekit-client";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { Matrix, loader } from "@/components/ui/matrix";
import { Conversation, ConversationContent, ConversationEmptyState } from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { startWebCall, webCallErrorMessage, type WebCallHandle, type WebCallStatus } from "@/lib/voice/livekit-web-call";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

interface LiveTurn {
  id: string;
  role: "agent" | "user";
  text: string;
}

function callErrorCopy(raw: string): { title: string; body: string } {
  if (/concurrency|didn't hang up|did not hang up/i.test(raw)) {
    return {
      title: "Line was stuck",
      body: "A previous test call didn’t hang up cleanly, so the line looked busy even with no one on it. Try again — we’ll clear it.",
    };
  }
  if (/balance|credits/i.test(raw)) {
    return {
      title: "Out of credits",
      body: "This workspace needs credits before a new call can start.",
    };
  }
  if (/microphone|permission|notallowed/i.test(raw)) {
    return {
      title: "Microphone blocked",
      body: "Allow microphone access in the browser, then try the call again.",
    };
  }
  if (/livekit|websocket|room/i.test(raw)) {
    return {
      title: "Couldn't reach the call server",
      body: "Voice calling isn’t reachable right now. Check the connection and try again.",
    };
  }
  return {
    title: "Couldn't connect",
    body: raw || "Something went wrong starting this call. Try again in a moment.",
  };
}

/**
 * Real browser "Test Agent" call — connects the mic to a LiveKit room via
 * POST /v1/calls, plays the agent's synthesized voice back, and shows a
 * live Bar Visualizer driven by the agent's actual audio frequency bands.
 *
 * Live transcript: listens for LiveKit's client-side `TranscriptionReceived`
 * event. Kupe's agent backend doesn't publish transcription segments yet
 * (no publisher found in kupe-agents), so this panel ships correctly empty
 * today and will populate automatically the moment the backend starts
 * emitting them — not a bug, a forward-compatible no-op until then.
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
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [attempt, setAttempt] = useState(0);
  const handleRef = useRef<WebCallHandle | null>(null);

  useEffect(() => {
    if (!open) {
      void handleRef.current?.disconnect();
      handleRef.current = null;
      setStatus("idle");
      setLevel(0);
      setMediaStream(null);
      setMuted(false);
      setErrorMsg(null);
      setTurns([]);
      return;
    }

    let cancelled = false;
    setErrorMsg(null);
    setTurns([]);
    void startWebCall(agentId, {
      onStatusChange: (s) => !cancelled && setStatus(s),
      onAgentAudioLevel: (l) => !cancelled && setLevel(l),
      onAgentTrack: (track) => !cancelled && setMediaStream(new MediaStream([track])),
      onError: (err) => {
        if (cancelled) return;
        setErrorMsg(friendlyVoiceError(err, webCallErrorMessage(err)));
      },
    }).then((handle) => {
      if (cancelled) {
        void handle.disconnect();
        return;
      }
      handleRef.current = handle;

      handle.room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], participant) => {
          if (cancelled) return;
          const role: LiveTurn["role"] = participant?.isLocal ? "user" : "agent";
          setTurns((prev) => {
            const next = [...prev];
            for (const seg of segments) {
              if (!seg.final || !seg.text) continue;
              const idx = next.findIndex((t) => t.id === seg.id);
              if (idx >= 0) next[idx] = { id: seg.id, role, text: seg.text };
              else next.push({ id: seg.id, role, text: seg.text });
            }
            return next;
          });
        },
      );
    }).catch(() => {
      // onError already recorded the message
    });

    return () => {
      cancelled = true;
      void handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [open, agentId, attempt]);

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

  const visualizerState: AgentState | undefined =
    status === "connecting"
      ? "connecting"
      : status === "connected"
        ? level > 0.04
          ? "speaking"
          : "listening"
        : undefined;

  const errorCopy = errorMsg ? callErrorCopy(errorMsg) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Test call with {agentName}</DialogTitle>
        <div className="flex flex-col items-center gap-5 px-6 pt-10 pb-5 text-center">
          <div className="relative size-16">
            <AgentAvatar seed={seed} size={64} className="size-full rounded-2xl" />
            {status === "connecting" && (
              <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-background shadow-sm">
                <Matrix rows={7} cols={7} frames={loader} fps={12} size={1.4} gap={0.4} palette={{ on: "var(--primary)", off: "transparent" }} ariaLabel="Connecting" />
              </span>
            )}
            {status === "connected" && (
              <span className="absolute -right-1 -bottom-1 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{agentName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{statusLabel}</p>
          </div>

          {errorCopy ? (
            <div className="w-full rounded-2xl border border-border bg-muted/40 px-4 py-4 text-left">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <PhoneOff className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{errorCopy.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{errorCopy.body}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full"
                    onClick={() => {
                      setErrorMsg(null);
                      setStatus("connecting");
                      setAttempt((n) => n + 1);
                    }}
                  >
                    <RotateCw className="size-3.5" />
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <BarVisualizer
              state={visualizerState}
              mediaStream={mediaStream}
              demo={!mediaStream && status === "connecting"}
              barCount={15}
              className="w-full"
            />
          )}

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

        <div className="flex h-56 flex-col border-t border-border">
          <Conversation className="flex-1">
            <ConversationContent className="p-3">
              {turns.length === 0 ? (
                <ConversationEmptyState
                  title="Transcript"
                  description={status === "connected" ? "Listening…" : "Starts once the call connects."}
                  className="h-full"
                />
              ) : (
                turns.map((t) => (
                  <Message key={t.id} from={t.role === "user" ? "user" : "assistant"}>
                    <MessageContent variant="contained">{t.text}</MessageContent>
                  </Message>
                ))
              )}
            </ConversationContent>
          </Conversation>
        </div>
      </DialogContent>
    </Dialog>
  );
}
