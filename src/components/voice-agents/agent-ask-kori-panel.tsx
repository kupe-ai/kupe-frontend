"use client";

import { useMemo, useState } from "react";
import { ArrowUp, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AiStar } from "@/components/brand/ai-star";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { copilotTurn } from "@/lib/api/voice/agent-builder";
import { KoriApiError } from "@/lib/api/kori-errors";

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
 * Embedded Ask Kupe companion for the agent editor — always visible on the right.
 * Backed by POST /v1/agents/{id}/copilot (falls back to Sarvam-105B when needed).
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
    return `Customize ${short.slice(0, 28)}${short.length > 28 ? "…" : ""}`;
  }, [agentName]);

  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: "k1",
      role: "kori",
      text: "What kind of business should this agent serve? I can update instructions, variables, and tests directly.",
      choices: STARTER_OPTIONS,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [sending, setSending] = useState(false);

  function resetChat() {
    setMessages([
      {
        id: `k-${Date.now()}`,
        role: "kori",
        text: "What kind of business should this agent serve? I can update instructions, variables, and tests directly.",
        choices: STARTER_OPTIONS,
      },
    ]);
    setDraft("");
    setOtherOpen(false);
    setOtherText("");
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
                      disabled={sending}
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Kupe is thinking…
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
            placeholder="Ask Kupe to change this agent…"
            disabled={sending}
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
            disabled={!draft.trim() || sending}
            aria-label="Send"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
