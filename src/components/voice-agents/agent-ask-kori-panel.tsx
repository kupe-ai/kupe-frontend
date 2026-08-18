"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, MicOff, Phone, PhoneOff, Wrench } from "lucide-react";
import { RoomEvent, type TranscriptionSegment } from "livekit-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Matrix, pulse } from "@/components/ui/matrix";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/context/workspace-context";
import { enterAgentScope, sendForAgent } from "@/lib/ask-ai/kupe-agent-store";
import { useKupeAgentStore } from "@/lib/ask-ai/use-kupe-agent-store";
import type { AgentStep } from "@/lib/ask-ai/types";
import { startWebCall, webCallErrorMessage, type WebCallHandle, type WebCallStatus } from "@/lib/voice/livekit-web-call";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

const STARTER_OPTIONS = [
  "Medical clinic / hospital (OPD, consultations)",
  "Salon or spa",
  "Home-service business (repair, cleaning, installation)",
  "Something else",
];

// Any tool call that plausibly changed the agent's saved config -- the
// editor should refetch after these so the left-hand form isn't stale.
const MUTATING_TOOLS = new Set([
  "update_agent",
  "commit_agent_version",
  "revert_agent_to_version",
  "archive_agent",
  "set_agent_demo_variables",
  "attach_tool_to_agent",
  "detach_tool_from_agent",
  "attach_analysis_to_agent",
  "detach_analysis_from_agent",
]);

type VoiceBubble = { id: string; role: "user" | "kori"; text: string; latencyMs?: number };

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Sub-800ms is the target for user-stops-speaking -> agent-starts-speaking. */
const LATENCY_TARGET_MS = 800;

/**
 * Embedded Ask Kupe companion for the agent editor — always visible on the
 * right. Text chat runs a live kupe-harness (Kai) session scoped to this
 * agent (see lib/ask-ai/kupe-agent-store.ts) and can actually edit the
 * agent via kupe-mcp tool calls, not just suggest changes. Talk uses a
 * LiveKit web call and is unrelated (real-time voice test of the agent
 * itself) -- its live transcript is shown in place of the Kai chat only
 * while a call is in progress.
 */
export function AgentAskKoriPanel({
  agentId,
  onAgentChanged,
  className,
}: {
  agentId: string;
  /** Fired when Kai mutates the agent so the editor can refetch without a full page reload. */
  onAgentChanged?: () => void;
  className?: string;
}) {
  const { org, project } = useWorkspace();
  const kupeStore = useKupeAgentStore();
  const [draft, setDraft] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");

  const [voiceMessages, setVoiceMessages] = useState<VoiceBubble[]>([]);
  const [callStatus, setCallStatus] = useState<WebCallStatus>("idle");
  const [level, setLevel] = useState(0);
  const [agentStream, setAgentStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const handleRef = useRef<WebCallHandle | null>(null);
  const pendingLatencyRef = useRef<number | null>(null);
  const live = callStatus === "connecting" || callStatus === "connected";

  // Enter this agent's scope on mount / when navigating between agents.
  // If the store's live session is already this agent's (e.g. we just
  // navigated here straight from creating it), its transcript carries
  // over instead of being wiped. Computed eagerly on first render (via
  // useState's lazy initializer) so it's known before paint, then kept in
  // sync if agentId changes without this component unmounting (React
  // Router reuses the element across /agents/:id param changes).
  const [continuingCreation, setContinuingCreation] = useState(() => enterAgentScope(agentId));
  const lastAgentId = useRef(agentId);
  useEffect(() => {
    if (lastAgentId.current !== agentId) {
      lastAgentId.current = agentId;
      setContinuingCreation(enterAgentScope(agentId));
    }
  }, [agentId]);

  // Refetch the agent once a turn that mutated it finishes.
  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (wasBusyRef.current && !kupeStore.busy && kupeStore.scopeAgentId === agentId) {
      const lastTurn = kupeStore.turns[kupeStore.turns.length - 1];
      const mutated = lastTurn?.steps.some((s) => s.kind === "tool_call" && MUTATING_TOOLS.has(s.name));
      if (mutated) onAgentChanged?.();
    }
    wasBusyRef.current = kupeStore.busy;
  }, [kupeStore.busy, kupeStore.turns, kupeStore.scopeAgentId, agentId, onAgentChanged]);

  useEffect(() => {
    return () => {
      void handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [agentId]);

  // Call duration ticker — starts once actually connected, freezes on end.
  useEffect(() => {
    if (callStatus !== "connected") return;
    const start = Date.now();
    setElapsedSec(0);
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [callStatus]);

  async function hangUp() {
    await handleRef.current?.disconnect();
    handleRef.current = null;
    setCallStatus("idle");
    setLevel(0);
    setAgentStream(null);
    setLocalStream(null);
    setMuted(false);
    setElapsedSec(0);
    pendingLatencyRef.current = null;
  }

  async function startTalk() {
    if (live) return;
    setCallStatus("connecting");
    setLevel(0);
    setAgentStream(null);
    setLocalStream(null);
    setMuted(false);
    setVoiceMessages([]);
    pendingLatencyRef.current = null;
    try {
      const handle = await startWebCall(agentId, {
        onStatusChange: (s) => setCallStatus(s),
        onAgentAudioLevel: (l) => setLevel(l),
        onAgentTrack: (track) => setAgentStream(new MediaStream([track])),
        onLocalTrack: (track) => setLocalStream(new MediaStream([track])),
        onError: (err) => {
          const msg = friendlyVoiceError(err, webCallErrorMessage(err));
          toast.error(msg);
          setCallStatus("error");
        },
      });
      handleRef.current = handle;
      handle.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
            kind?: string;
            type?: string;
            value_ms?: number;
          };
          if (parsed.kind === "latency" && parsed.type === "perceived_response" && typeof parsed.value_ms === "number") {
            pendingLatencyRef.current = parsed.value_ms;
          }
        } catch {
          // ignore non-JSON / non-latency data messages
        }
      });
      handle.room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], participant) => {
          const role: "user" | "kori" = participant?.isLocal ? "user" : "kori";
          setVoiceMessages((prev) => {
            const next = [...prev];
            for (const seg of segments) {
              if (!seg.final || !seg.text) continue;
              const idx = next.findIndex((t) => t.id === seg.id);
              const latencyMs =
                role === "kori" && idx < 0 ? (pendingLatencyRef.current ?? undefined) : undefined;
              if (latencyMs !== undefined) pendingLatencyRef.current = null;
              const bubble: VoiceBubble =
                role === "user"
                  ? { id: seg.id, role: "user", text: seg.text }
                  : { id: seg.id, role: "kori", text: seg.text, latencyMs };
              if (idx >= 0) next[idx] = { ...next[idx], text: seg.text };
              else next.push(bubble);
            }
            return next;
          });
        },
      );
    } catch (err) {
      const msg = friendlyVoiceError(err, webCallErrorMessage(err));
      toast.error(msg);
      setCallStatus("error");
    }
  }

  function toggleMute() {
    const room = handleRef.current?.room;
    if (!room) return;
    const next = !muted;
    void room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  async function pushUser(text: string) {
    const trimmed = text.trim();
    if (!trimmed || kupeStore.busy) return;
    if (!org?.id || !project?.id) {
      toast.error("Select an organization and project first");
      return;
    }
    await sendForAgent(org.id, project.id, agentId, trimmed);
  }

  function onChoice(choice: string) {
    if (choice === "Something else") {
      setOtherOpen(true);
      return;
    }
    void pushUser(choice);
  }

  function onSend() {
    if (otherOpen && otherText.trim()) {
      void pushUser(otherText);
      setOtherText("");
      setOtherOpen(false);
      return;
    }
    void pushUser(draft);
    setDraft("");
  }

  const agentSpeaking = live && callStatus === "connected" && level > 0.04;
  const vizStream = agentSpeaking ? agentStream : (localStream ?? agentStream);
  const visualizerState: AgentState | undefined = live
    ? callStatus === "connecting"
      ? "connecting"
      : agentSpeaking
        ? "speaking"
        : "listening"
    : "listening";

  const statusLabel =
    callStatus === "connecting"
      ? "Connecting…"
      : callStatus === "connected"
        ? muted
          ? "Muted"
          : "Live — talk now"
        : callStatus === "error"
          ? "Couldn't connect"
          : "Idle — talk or type";

  const showStarters = kupeStore.turns.length === 0 && !continuingCreation;
  const sending = kupeStore.busy && kupeStore.scopeAgentId === agentId;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-l border-border bg-background",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border px-3 py-3">
        <BarVisualizer
          state={visualizerState}
          mediaStream={vizStream}
          demo={!vizStream}
          flat
          barCount={13}
          className="h-20 w-full rounded-xl bg-muted/50 p-2.5"
        />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            {statusLabel}
            {callStatus === "connected" && (
              <span className="font-mono"> · {formatDuration(elapsedSec)}</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {live ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={muted ? "Unmute" : "Mute"}
                  onClick={toggleMute}
                  disabled={callStatus !== "connected"}
                >
                  {muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="End call"
                  onClick={() => void hangUp()}
                >
                  <PhoneOff className="size-3.5" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                onClick={() => void startTalk()}
              >
                <Phone className="size-3.5" />
                Talk
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {live ? (
          voiceMessages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="animate-pop-in-up flex justify-end">
                <div className="max-w-[92%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="animate-pop-in-up space-y-1.5">
                <p className="text-sm leading-relaxed text-foreground">{m.text}</p>
                {m.latencyMs !== undefined && (
                  <span
                    className={`block text-[10px] ${
                      m.latencyMs <= LATENCY_TARGET_MS ? "text-muted-foreground" : "text-amber-600"
                    }`}
                  >
                    responded in {Math.round(m.latencyMs)} ms
                  </span>
                )}
              </div>
            ),
          )
        ) : (
          <>
            {showStarters && (
              <div className="animate-pop-in-up space-y-3">
                <p className="text-sm leading-relaxed text-foreground">
                  Talk to try this agent, or type to customize instructions, variables, and tests.
                </p>
                <div className="space-y-2">
                  {STARTER_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={sending}
                      onClick={() => onChoice(c)}
                      className="pressable block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
                    >
                      {c}
                    </button>
                  ))}
                  {otherOpen && (
                    <div className="flex gap-2 rounded-xl border border-border p-2">
                      <input
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="Describe your business…"
                        className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSend();
                        }}
                      />
                      <Button type="button" size="sm" onClick={onSend} disabled={sending}>
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {kupeStore.turns.map((t) =>
              t.role === "user" ? (
                <div key={t.id} className="animate-pop-in-up flex justify-end">
                  <div className="max-w-[92%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                    {t.text}
                  </div>
                </div>
              ) : (
                <div key={t.id} className="animate-pop-in-up space-y-2">
                  {t.steps.length > 0 && <StepsList steps={t.steps} streaming={t.streaming} />}
                  {t.text && <p className="text-sm leading-relaxed text-foreground">{t.text}</p>}
                  {t.error && <p className="text-xs text-destructive">{t.error}</p>}
                  {t.streaming && !t.text && t.steps.length === 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <Matrix
                        rows={7}
                        cols={7}
                        frames={pulse}
                        fps={16}
                        size={1.6}
                        gap={0.5}
                        palette={{ on: "var(--primary)", off: "transparent" }}
                        ariaLabel=""
                      />
                      <span className="kori-shimmer-text font-medium">Kupe is thinking…</span>
                    </div>
                  )}
                </div>
              ),
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={live ? "Talking — type to ask Kupe after the call…" : "Ask AI or describe a change…"}
            disabled={sending || live}
            className="min-h-[44px] max-h-28 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon-sm"
            className="mb-0.5 shrink-0 rounded-full"
            onClick={onSend}
            disabled={!draft.trim() || sending || live}
            aria-label="Send"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}

/** Collapsible-free inline step list -- "Agent steps" condensed to fit this
 * panel's compact chat bubbles: reasoning as an italic line, tool calls as
 * a small labeled row with a running/done state. */
function StepsList({ steps, streaming }: { steps: AgentStep[]; streaming: boolean }) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
      {steps.map((step, i) =>
        step.kind === "reasoning" ? (
          <p key={i} className="italic text-muted-foreground">
            {step.text}
          </p>
        ) : (
          <div key={i} className="flex items-center gap-1.5">
            <Wrench className={cn("size-3 shrink-0", step.isError ? "text-destructive" : "text-muted-foreground")} />
            <span className={cn("font-mono", step.isError && "text-destructive")}>{step.name}</span>
            {!step.done && <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        ),
      )}
      {streaming && <span className="sr-only">Kupe is still working…</span>}
    </div>
  );
}
