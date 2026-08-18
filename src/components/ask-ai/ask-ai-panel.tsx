"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Send, Wrench, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Conversation, ConversationContent, ConversationEmptyState } from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { AiStar } from "@/components/brand/ai-star";
import { cn } from "@/lib/utils";
import { useAskAiPanel } from "@/lib/ask-ai/panel-context";
import { useKupeAgent } from "@/lib/ask-ai/use-kupe-agent";
import type { AgentStep, ChatTurn } from "@/lib/ask-ai/types";

const SUGGESTIONS = [
  "Create a new agent for after-hours support",
  "Launch a campaign from a CSV of leads",
  "Show today's call analytics",
  "Edit the current agent's system prompt",
];

export function AskAiPanel() {
  const { open, setOpen } = useAskAiPanel();
  const { turns, busy, sendMessage, reset, hasWorkspace } = useKupeAgent();
  const [draft, setDraft] = useState("");

  const submit = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setDraft("");
    void sendMessage(value);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="gap-1 border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-[15px]">
            <AiStar size={16} />
            Ask Kupe
          </SheetTitle>
          <SheetDescription className="text-xs">
            Manages agents, campaigns, calls, and analytics for this workspace.
          </SheetDescription>
        </SheetHeader>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-4 px-4">
            {turns.length === 0 ? (
              <ConversationEmptyState
                icon={<Sparkles className="size-6" />}
                title="What should Kupe do?"
                description="Try one of these, or type your own request below."
              >
                <div className="mt-2 flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-[13px] font-normal"
                      onClick={() => submit(s)}
                      disabled={!hasWorkspace}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              turns.map((turn) => <Turn key={turn.id} turn={turn} />)
            )}
          </ConversationContent>
        </Conversation>

        <div className="shrink-0 space-y-2 border-t border-border p-3">
          {!hasWorkspace ? (
            <p className="text-xs text-muted-foreground">Select a workspace to start.</p>
          ) : null}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              placeholder="Ask anything… (Shift+Enter for new line)"
              className="max-h-40 min-h-10 flex-1 resize-none text-sm"
              disabled={!hasWorkspace}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => submit(draft)}
              disabled={!hasWorkspace || busy || !draft.trim()}
              aria-label="Send"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          {turns.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={reset}>
              Start a new conversation
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <Message from="user">
        <MessageContent>{turn.text}</MessageContent>
      </Message>
    );
  }

  const toolCalls = turn.steps.filter((s) => s.kind === "tool_call").length;
  const thoughts = turn.steps.filter((s) => s.kind === "reasoning").length;

  return (
    <div className="flex flex-col gap-2">
      {turn.steps.length > 0 ? <StepsDisclosure steps={turn.steps} toolCalls={toolCalls} thoughts={thoughts} streaming={turn.streaming} /> : null}
      {turn.text ? (
        <Message from="assistant">
          <MessageContent variant="flat" className="prose prose-sm max-w-none dark:prose-invert">
            {turn.text}
          </MessageContent>
        </Message>
      ) : turn.streaming && turn.steps.length === 0 ? (
        <ReasoningShimmer />
      ) : null}
      {turn.error ? <p className="text-xs text-destructive">{turn.error}</p> : null}
    </div>
  );
}

function StepsDisclosure({
  steps,
  toolCalls,
  thoughts,
  streaming,
}: {
  steps: AgentStep[];
  toolCalls: number;
  thoughts: number;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(streaming);
  const parts = [
    toolCalls > 0 ? `${toolCalls} tool call${toolCalls === 1 ? "" : "s"}` : null,
    thoughts > 0 ? `${thoughts} thought${thoughts === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {streaming ? <Loader2 className="size-3 animate-spin" /> : null}
        Agent steps{parts.length ? ` · ${parts.join(" · ")}` : ""}
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-border px-2.5 py-2">
          {steps.map((step, i) =>
            step.kind === "reasoning" ? (
              <p key={i} className="italic text-muted-foreground">
                {step.text}
              </p>
            ) : (
              <div key={i} className="flex items-start gap-1.5">
                <Wrench className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <span className={cn("font-mono", step.isError && "text-destructive")}>{step.name}</span>
                  {!step.done ? <span className="ml-1 text-muted-foreground">running…</span> : null}
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function ReasoningShimmer() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </span>
      Thinking…
    </div>
  );
}
