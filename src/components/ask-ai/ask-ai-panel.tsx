"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Conversation, ConversationContent, ConversationEmptyState, useChatStickScroll } from "@/components/ui/conversation";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { KAI_AVATAR_SEED } from "@/components/voice-agents/nav-item-icon";
import { useAskAiPanel } from "@/lib/ask-ai/panel-context";
import { useKupeAgentStore } from "@/lib/ask-ai/use-kupe-agent-store";
import {
  removeAttachment,
  resetSession,
  sendForAgent,
  sendForNewAgent,
  stopTurn,
  uploadAttachment,
} from "@/lib/ask-ai/kupe-agent-store";
import { ChatComposer, SuggestionChips } from "@/components/ask-ai/chat-composer";
import { AskKupeTurn } from "@/components/ask-ai/ask-kupe-thread";
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
  const { contextRef: chatScrollRef, scrollToBottomOnNewTask } = useChatStickScroll();
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
    scrollToBottomOnNewTask();
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
            <AgentAvatar seed={KAI_AVATAR_SEED} size={16} alt="" />
            Ask Kai
          </SheetTitle>
          <SheetDescription className="text-xs">
            Manages agents, campaigns, calls, and analytics for this workspace.
          </SheetDescription>
        </SheetHeader>

        <Conversation className="min-h-0 flex-1" contextRef={chatScrollRef}>
          <ConversationContent className="gap-4 px-4">
            {kupeStore.turns.length === 0 ? (
              <ConversationEmptyState
                icon={<AgentAvatar seed={KAI_AVATAR_SEED} size={24} alt="" />}
                title="What should Kai do?"
                description="Try one of these, or type your own request below."
              >
                <div className="mt-2">
                  <SuggestionChips items={SUGGESTIONS} onPick={submit} disabled={!hasWorkspace || kupeStore.busy} />
                </div>
              </ConversationEmptyState>
            ) : (
              kupeStore.turns.map((turn) => <AskKupeTurn key={turn.id} turn={turn} />)
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
            onStop={stopTurn}
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
            onNewConversation={kupeStore.turns.length > 0 ? () => resetSession() : undefined}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
