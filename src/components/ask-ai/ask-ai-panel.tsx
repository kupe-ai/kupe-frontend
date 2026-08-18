"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationEmptyState } from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { AiStar } from "@/components/brand/ai-star";
import { Sparkles } from "lucide-react";
import { useAskAiPanel } from "@/lib/ask-ai/panel-context";
import { useKupeAgentStore } from "@/lib/ask-ai/use-kupe-agent-store";
import {
  removeAttachment,
  resetSession,
  sendForAgent,
  sendForNewAgent,
  uploadAttachment,
} from "@/lib/ask-ai/kupe-agent-store";
import type { ChatTurn } from "@/lib/ask-ai/types";
import { AgentSteps, WorkingShimmer } from "@/components/ask-ai/agent-steps";
import { MarkdownMessage } from "@/components/ask-ai/markdown-message";
import { ChatComposer, SuggestionChips } from "@/components/ask-ai/chat-composer";
import { sanitizeChatError } from "@/lib/ask-ai/public-error";
import { useWorkspaceOptional } from "@/context/workspace-context";

const SUGGESTIONS = [
  "Create a new agent for after-hours support",
  "Launch a campaign from a CSV of leads",
  "Show today's call analytics",
  "Edit the current agent's system prompt",
];

export function AskAiPanel() {
  const { open, setOpen } = useAskAiPanel();
  const kupeStore = useKupeAgentStore();
  const workspace = useWorkspaceOptional();
  const [draft, setDraft] = useState("");
  const orgId = workspace?.org?.id;
  const projectId = workspace?.project?.id;
  const hasWorkspace = Boolean(orgId && projectId);

  const submit = (text: string) => {
    const value = text.trim();
    if ((!value && kupeStore.attachments.length === 0) || kupeStore.busy) return;
    if (!orgId || !projectId) {
      toast.error("Select an organization and project first");
      return;
    }
    setDraft("");
    const message = value || "Use the attached file.";
    if (kupeStore.scopeAgentId) {
      void sendForAgent(orgId, projectId, kupeStore.scopeAgentId, message);
    } else {
      void sendForNewAgent(orgId, projectId, message);
    }
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
            {kupeStore.turns.length === 0 ? (
              <ConversationEmptyState
                icon={<Sparkles className="size-6" />}
                title="What should Kupe do?"
                description="Try one of these, or type your own request below."
              >
                <div className="mt-2">
                  <SuggestionChips items={SUGGESTIONS} onPick={submit} disabled={!hasWorkspace || kupeStore.busy} />
                </div>
              </ConversationEmptyState>
            ) : (
              kupeStore.turns.map((turn) => <Turn key={turn.id} turn={turn} />)
            )}
          </ConversationContent>
        </Conversation>

        <div className="shrink-0 space-y-2 border-t border-border p-3">
          {!hasWorkspace ? <p className="text-xs text-muted-foreground">Select a workspace to start.</p> : null}
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={() => submit(draft)}
            placeholder="Ask anything… (Shift+Enter for new line)"
            disabled={!hasWorkspace}
            sending={kupeStore.busy}
            attachments={kupeStore.attachments}
            onAttach={(file) => {
              if (!orgId) {
                toast.error("Select an organization first");
                return;
              }
              void uploadAttachment(orgId, file).catch((err) =>
                toast.error(err instanceof Error ? err.message : "Upload failed"),
              );
            }}
            onRemoveAttachment={removeAttachment}
          />
          {kupeStore.turns.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              onClick={() => resetSession()}
            >
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

  return (
    <div className="flex flex-col gap-2">
      {turn.steps.length > 0 ? <AgentSteps steps={turn.steps} streaming={turn.streaming} /> : null}
      {turn.text ? (
        <Message from="assistant">
          <MessageContent variant="flat">
            <MarkdownMessage text={turn.text} />
          </MessageContent>
        </Message>
      ) : turn.streaming && turn.steps.length === 0 ? (
        <WorkingShimmer label={turn.status || "Kupe is working…"} />
      ) : null}
      {turn.error ? <p className="text-xs text-destructive">{sanitizeChatError(turn.error)}</p> : null}
    </div>
  );
}
