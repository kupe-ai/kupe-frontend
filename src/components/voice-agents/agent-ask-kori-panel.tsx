"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, MicOff, Phone, PhoneOff, Plus, Sparkles } from "lucide-react";
import { RoomEvent, type TranscriptionSegment } from "livekit-client";
import { toast } from "sonner";
import { AiStar } from "@/components/brand/ai-star";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Matrix, pulse } from "@/components/ui/matrix";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { cn } from "@/lib/utils";
import { copilotTurn } from "@/lib/api/voice/agent-builder";
import { KoriApiError } from "@/lib/api/kori-errors";
import { startWebCall, webCallErrorMessage, type WebCallHandle, type WebCallStatus } from "@/lib/voice/livekit-web-call";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";

const STARTER_OPTIONS = [
  "Medical clinic / hospital (OPD, consultations)",
  "Salon or spa",
  "Home-service business (repair, cleaning, installation)",
  "Something else",
];

type ChatBubble =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "kori"; text: string; choices?: string[]; actions?: string[] };

/**
 * Embedded Ask AI companion for the agent editor — always visible on the right.
 * Text chat is backed by POST /v1/agents/{id}/copilot. Talk uses a LiveKit
 * web call with the Bar Visualizer driven by the agent's audio.
 */
export function AgentAskKoriPanel({
  agentId,
  agentName,
  onAgentChanged,
  className,
}: {
  agentId: string;
  agentName: string;
  /** Fired when copilot mutates the agent so the editor can refetch without a full page reload. */
  onAgentChanged?: () => void;
  className?: string;
}) {
  const title = useMemo(() => {
    const short = agentName.replace(/^Conversation Agent\s+/i, "Agent ");
    return `Ask AI · ${short.slice(0, 22)}${short.length > 22 ? "…" : ""}`;
  }, [agentName]);

  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: "k1",
      role: "kori",
      text: "Talk to try this agent, or type to customize instructions, variables, and tests.",
      choices: STARTER_OPTIONS,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [sending, setSending] = useState(false);

  const [callStatus, setCallStatus] = useState<WebCallStatus>("idle");
  const [level, setLevel] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const handleRef = useRef<WebCallHandle | null>(null);
  const live = callStatus === "connecting" || callStatus === "connected";

  useEffect(() => {
    return () => {
      void handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [agentId]);

  function resetChat() {
    void hangUp();
    setMessages([
      {
        id: `k-${Date.now()}`,
        role: "kori",
        text: "Talk to try this agent, or type to customize instructions, variables, and tests.",
        choices: STARTER_OPTIONS,
      },
    ]);
    setDraft("");
    setOtherOpen(false);
    setOtherText("");
  }

  async function hangUp() {
    await handleRef.current?.disconnect();
    handleRef.current = null;
    setCallStatus("idle");
    setLevel(0);
    setMediaStream(null);
    setMuted(false);
  }

  async function startTalk() {
    if (live) return;
    setCallStatus("connecting");
    setLevel(0);
    setMediaStream(null);
    setMuted(false);
    try {
      const handle = await startWebCall(agentId, {
        onStatusChange: (s) => setCallStatus(s),
        onAgentAudioLevel: (l) => setLevel(l),
        onAgentTrack: (track) => setMediaStream(new MediaStream([track])),
        onError: (err) => {
          const msg = friendlyVoiceError(err, webCallErrorMessage(err));
          toast.error(msg);
          setCallStatus("error");
        },
      });
      handleRef.current = handle;
      handle.room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], participant) => {
          const role: "user" | "kori" = participant?.isLocal ? "user" : "kori";
          setMessages((prev) => {
            const next = [...prev];
            for (const seg of segments) {
              if (!seg.final || !seg.text) continue;
              const idx = next.findIndex((t) => t.id === seg.id);
              const bubble: ChatBubble =
                role === "user"
                  ? { id: seg.id, role: "user", text: seg.text }
                  : { id: seg.id, role: "kori", text: seg.text };
              if (idx >= 0) next[idx] = bubble;
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
    if (!trimmed || sending) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
    setSending(true);
    try {
      const { reply, actions } = await copilotTurn(agentId, trimmed);
      setMessages((m) => [...m, { id: `k-${Date.now()}`, role: "kori", text: reply, actions }]);
      if (actions?.length) onAgentChanged?.();
    } catch (err) {
      const msg =
        err instanceof KoriApiError
          ? err.message
          : "Kupe couldn't respond — try again";
      toast.error(msg);
      setMessages((m) => [
        ...m,
        {
          id: `k-err-${Date.now()}`,
          role: "kori",
          text: msg,
        },
      ]);
    } finally {
      setSending(false);
    }
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

  const visualizerState: AgentState | undefined = live
    ? callStatus === "connecting"
      ? "connecting"
      : level > 0.04
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

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-l border-border bg-background",
        className,
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <AiStar size={18} />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="New chat"
          onClick={resetChat}
        >
          <Plus className="size-4" />
        </Button>
      </header>

      <div className="shrink-0 border-b border-border px-3 py-3">
        <BarVisualizer
          state={visualizerState}
          mediaStream={mediaStream}
          demo={!mediaStream}
          barCount={13}
          className="h-20 w-full rounded-xl bg-muted/50 p-2.5"
        />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">{statusLabel}</p>
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
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[92%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="size-3.5 text-primary" />
                </span>
                <p className="text-sm leading-relaxed text-foreground">{m.text}</p>
              </div>
              {m.actions && m.actions.length > 0 && (
                <ul className="ml-9 space-y-1">
                  {m.actions.map((a, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1 rounded-full bg-emerald-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              {m.choices && (
                <div className="ml-9 space-y-2">
                  {m.choices.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={sending || live}
                      onClick={() => onChoice(c)}
                      className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
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
              )}
            </div>
          ),
        )}
        {sending && (
          <div className="ml-9 space-y-2">
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
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
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
