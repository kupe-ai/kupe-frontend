"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, RotateCw } from "lucide-react";
import { RoomEvent, type TranscriptionSegment } from "livekit-client";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { Matrix, loader } from "@/components/ui/matrix";
import { ConversationEmptyState } from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { api } from "@/lib/api";
import { startWebCall, webCallErrorMessage, type WebCallHandle, type WebCallStatus } from "@/lib/voice/livekit-web-call";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

interface LiveTurn {
  id: string;
  role: "agent" | "user";
  text: string;
  /** Turn-taking latency for this turn (user stopped talking -> this reply
   * started), from the backend's `perceived_response` latency event. Only
   * ever set on agent turns. */
  latencyMs?: number;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function demoVarLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

/** Sub-800ms is the target for user-stops-speaking -> agent-starts-speaking. */
const LATENCY_TARGET_MS = 800;

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
 * live bar visualizer: user mic while listening, agent audio while speaking.
 *
 * Live transcript: the agent publishes `{kind:"transcript"}` on the LiveKit
 * data channel. TranscriptionReceived is a fallback if a provider also
 * ships LiveKit transcription segments.
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
  const [agentStream, setAgentStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [demoValues, setDemoValues] = useState<Record<string, string>>({});
  const [demoDirty, setDemoDirty] = useState(false);
  const handleRef = useRef<WebCallHandle | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const demoValuesRef = useRef<Record<string, string>>({});
  // Latest "user stopped -> agent started" latency, stashed here as it
  // arrives and attached to the next agent turn that lands.
  const pendingLatencyRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      void handleRef.current?.disconnect();
      handleRef.current = null;
      setStatus("idle");
      setLevel(0);
      setAgentStream(null);
      setLocalStream(null);
      setMuted(false);
      setErrorMsg(null);
      setTurns([]);
      setElapsedSec(0);
      setDemoValues({});
      setDemoDirty(false);
      demoValuesRef.current = {};
      pendingLatencyRef.current = null;
      return;
    }

    let cancelled = false;
    void api
      .getAgentDemoVariables(agentId)
      .then((res) => {
        if (cancelled) return;
        const values = res.values || {};
        setDemoValues(values);
        demoValuesRef.current = values;
        setDemoDirty(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDemoValues({});
        demoValuesRef.current = {};
      });

    return () => {
      cancelled = true;
    };
  }, [open, agentId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setErrorMsg(null);
    setTurns([]);
    setElapsedSec(0);
    pendingLatencyRef.current = null;
    void startWebCall(agentId, {
      onStatusChange: (s) => !cancelled && setStatus(s),
      onAgentAudioLevel: (l) => !cancelled && setLevel(l),
      onAgentTrack: (track) => !cancelled && setAgentStream(new MediaStream([track])),
      onLocalTrack: (track) => !cancelled && setLocalStream(new MediaStream([track])),
      onError: (err) => {
        if (cancelled) return;
        setErrorMsg(friendlyVoiceError(err, webCallErrorMessage(err)));
      },
    }, demoValuesRef.current).then((handle) => {
      if (cancelled) {
        void handle.disconnect();
        return;
      }
      handleRef.current = handle;

      handle.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
            kind?: string;
            role?: string;
            text?: string;
            final?: boolean;
            type?: string;
            value_ms?: number;
          };
          if (parsed.kind === "latency") {
            if (parsed.type === "perceived_response" && typeof parsed.value_ms === "number") {
              pendingLatencyRef.current = parsed.value_ms;
            }
            return;
          }
          if (parsed.kind !== "transcript" || !parsed.text) return;
          const role: LiveTurn["role"] = parsed.role === "user" ? "user" : "agent";
          const id = `${role}-live`;
          const latencyMs =
            role === "agent" && parsed.final !== false ? (pendingLatencyRef.current ?? undefined) : undefined;
          if (latencyMs !== undefined) pendingLatencyRef.current = null;
          setTurns((prev) => {
            const next = [...prev];
            if (parsed.final === false) {
              const idx = next.findIndex((t) => t.id === id);
              if (idx >= 0) next[idx] = { id, role, text: parsed.text! };
              else next.push({ id, role, text: parsed.text! });
              return next;
            }
            const liveIdx = next.findIndex((t) => t.id === id);
            const turn = { id: `${role}-${next.length}-${parsed.text!.slice(0, 12)}`, role, text: parsed.text!, latencyMs };
            if (liveIdx >= 0) next[liveIdx] = turn;
            else next.push(turn);
            return next;
          });
        } catch {
          // ignore non-transcript data messages
        }
      });
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
              const latencyMs =
                role === "agent" && idx < 0 ? (pendingLatencyRef.current ?? undefined) : next[idx]?.latencyMs;
              if (latencyMs !== undefined && role === "agent" && idx < 0) pendingLatencyRef.current = null;
              if (idx >= 0) next[idx] = { id: seg.id, role, text: seg.text, latencyMs: next[idx].latencyMs };
              else next.push({ id: seg.id, role, text: seg.text, latencyMs });
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

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  // Call duration ticker — starts once the call is actually connected, not
  // while dialing, and stops (freezes, doesn't reset) once it ends.
  useEffect(() => {
    if (status !== "connected") return;
    const start = Date.now();
    setElapsedSec(0);
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

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
  const demoKeys = Object.keys(demoValues);

  const agentSpeaking = status === "connected" && level > 0.04;
  const vizStream = agentSpeaking ? agentStream : (localStream ?? agentStream);
  const visualizerState: AgentState | undefined =
    status === "connecting"
      ? "connecting"
      : status === "connected"
        ? agentSpeaking
          ? "speaking"
          : "listening"
        : undefined;

  const errorCopy = errorMsg ? callErrorCopy(errorMsg) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Test call with {agentName}</DialogTitle>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-4 px-6 pt-10 pb-5 sm:w-[300px] sm:overflow-y-auto sm:border-r sm:border-border sm:pt-8 sm:pb-6">
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
                mediaStream={vizStream}
                demo={!vizStream && status === "connecting"}
                flat
                barCount={15}
                className="w-full sm:h-44"
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

            {demoKeys.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Demo values</p>
                  {demoDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 rounded-full px-2 text-[11px]"
                      onClick={() => {
                        setDemoDirty(false);
                        setErrorMsg(null);
                        setAttempt((n) => n + 1);
                      }}
                    >
                      <RotateCw className="size-3" />
                      Restart with these
                    </Button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {demoKeys.map((key) => (
                    <label key={key} className="min-w-0">
                      <span className="text-[10px] text-muted-foreground capitalize">{demoVarLabel(key)}</span>
                      <Input
                        value={demoValues[key] ?? ""}
                        onChange={(e) => {
                          const next = { ...demoValues, [key]: e.target.value };
                          setDemoValues(next);
                          demoValuesRef.current = next;
                          setDemoDirty(true);
                        }}
                        className="h-7 text-xs"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-t border-border sm:border-t-0">
            <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 pr-12">
              <div className="relative size-11 shrink-0">
                <AgentAvatar seed={seed} size={44} className="size-full rounded-xl" />
                {status === "connecting" && (
                  <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-background shadow-sm">
                    <Matrix rows={7} cols={7} frames={loader} fps={12} size={1.2} gap={0.35} palette={{ on: "var(--primary)", off: "transparent" }} ariaLabel="Connecting" />
                  </span>
                )}
                {status === "connected" && (
                  <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{agentName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                  {statusLabel}
                  {(status === "connected" || status === "ended") && elapsedSec > 0 && (
                    <span className="font-mono normal-case"> · {formatDuration(elapsedSec)}</span>
                  )}
                </p>
              </div>
            </div>
            <div
              ref={transcriptRef}
              className="h-56 min-h-0 overflow-y-scroll overscroll-contain p-3 sm:h-auto sm:flex-1"
            >
              {turns.length === 0 ? (
                <ConversationEmptyState
                  title="Transcript"
                  description={status === "connected" ? "Listening…" : "Starts once the call connects."}
                  className="h-full min-h-48"
                />
              ) : (
                <div className="flex flex-col gap-0.5">
                  {turns.map((t) => (
                    <div key={t.id} className={t.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
                      <Message from={t.role === "user" ? "user" : "assistant"}>
                        <MessageContent variant="contained">{t.text}</MessageContent>
                      </Message>
                      {t.latencyMs !== undefined && (
                        <span
                          className={`mt-0.5 px-1 text-[10px] ${
                            t.latencyMs <= LATENCY_TARGET_MS ? "text-muted-foreground" : "text-amber-600"
                          }`}
                        >
                          responded in {Math.round(t.latencyMs)} ms
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
