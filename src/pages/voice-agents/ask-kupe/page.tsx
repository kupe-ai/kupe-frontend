"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { KAI_AVATAR_SEED } from "@/components/voice-agents/nav-item-icon";
import { CyclingPromptPlaceholder } from "@/components/voice-agents/cycling-prompt";
import { VoicePageHeader } from "@/components/voice-agents/shared";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent } from "@/components/ui/conversation";
import { AttachmentChips, ChatComposer, SuggestionChips } from "@/components/ask-ai/chat-composer";
import { AskKupeTurn } from "@/components/ask-ai/ask-kupe-thread";
import { useWorkspace } from "@/context/workspace-context";
import {
  removeAttachment,
  resetSession,
  sendForAgent,
  sendForNewAgent,
  uploadAttachment,
} from "@/lib/ask-ai/kupe-agent-store";
import { useKupeAgentStore } from "@/lib/ask-ai/use-kupe-agent-store";

const SUGGESTIONS = [
  "Create a collections agent",
  "EMI reminder agent",
  "Lead qualification",
  "Cart recovery",
];

export default function AskKupePage() {
  const kupeStore = useKupeAgentStore();
  const { org, project } = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const orgId = org?.id;
  const projectId = project?.id;
  const hasWorkspace = Boolean(orgId && projectId);
  const busy = kupeStore.busy;
  const chatting = kupeStore.turns.length > 0;
  const canSubmit = (prompt.trim().length > 0 || kupeStore.attachments.length > 0) && !busy && hasWorkspace;

  useEffect(() => {
    document.title = "Ask Kai · Voice Agents · Kupe";
  }, []);

  function submit(text = prompt) {
    const value = text.trim();
    if ((!value && kupeStore.attachments.length === 0) || busy) return;
    if (!orgId || !projectId) {
      toast.error("Select an organization and project first");
      return;
    }
    setPrompt("");
    const message = value || "Use the attached file.";
    if (kupeStore.scopeAgentId) {
      void sendForAgent(orgId, projectId, kupeStore.scopeAgentId, message);
    } else {
      void sendForNewAgent(orgId, projectId, message);
    }
  }

  async function onAttach(file: File) {
    if (!orgId) {
      toast.error("Select an organization first");
      return;
    }
    try {
      await uploadAttachment(orgId, file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[min(52%,36rem)]"
      >
        <div
          className="absolute inset-0 opacity-70 dark:opacity-100"
          style={{
            background: [
              "radial-gradient(ellipse 90% 70% at 100% 22%, color-mix(in oklab, var(--kupe-hero-bright) 55%, transparent) 0%, color-mix(in oklab, var(--kupe-hero) 38%, transparent) 32%, transparent 68%)",
              "radial-gradient(ellipse 85% 65% at 100% 82%, color-mix(in oklab, var(--kupe-hero-glow) 40%, transparent) 0%, color-mix(in oklab, var(--kupe-hero) 28%, transparent) 36%, transparent 72%)",
              "linear-gradient(to left, color-mix(in oklab, var(--kupe-hero-bright) 28%, transparent) 0%, color-mix(in oklab, var(--kupe-hero) 22%, transparent) 18%, color-mix(in oklab, var(--kupe-hero) 10%, transparent) 42%, transparent 78%)",
            ].join(", "),
          }}
        />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[color-mix(in_oklab,var(--kupe-hero-bright)_55%,transparent)] to-transparent" />
      </div>

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-4 py-5 md:px-6 md:py-6">
      <VoicePageHeader
        title="Ask Kai"
        className="relative z-[1]"
        actions={
          <p className="hidden text-[13px] text-muted-foreground sm:block">
            Helper agent of Kupe AI
          </p>
        }
      />

      {!chatting ? (
        <section className="mt-10 flex flex-1 flex-col items-center text-center">
          <AgentAvatar seed={KAI_AVATAR_SEED} muted size={64} alt="" className="text-neutral-500 opacity-60 dark:text-neutral-400" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            What should Kai do?
          </h1>
          <div className="mt-5 w-full max-w-2xl space-y-3">
            <AttachmentChips files={kupeStore.attachments} onRemove={removeAttachment} />
            <div className="group/nav flex w-full items-center rounded-full border border-input bg-background shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onAttach(file);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-1.5 size-9 shrink-0 rounded-full"
                onClick={() => fileRef.current?.click()}
                disabled={busy || !hasWorkspace}
                aria-label="Attach CSV"
              >
                <Paperclip className="size-4" />
              </Button>
              <div className="relative min-w-0 flex-1 text-left">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  className="h-12 w-full min-w-0 rounded-full border-0 bg-transparent px-3 text-left text-sm outline-none placeholder:text-muted-foreground md:h-14 md:text-base"
                  placeholder={focused && !prompt ? "Ask Kai…" : undefined}
                  aria-label="Ask Kai"
                  disabled={busy || !hasWorkspace}
                />
                {!prompt && !focused ? (
                  <CyclingPromptPlaceholder
                    paused={busy}
                    prefix="Ask Kai to"
                    suffixes={[
                      "create a voice agent that qualifies inbound leads",
                      "launch a campaign from a CSV of leads",
                      "show today's call analytics",
                      "edit an agent's system prompt",
                    ]}
                  />
                ) : null}
              </div>
              <Button
                type="button"
                size="icon"
                className="mr-1.5 size-9 shrink-0 rounded-full"
                onClick={() => submit()}
                aria-label="Send"
                loading={busy}
                disabled={!canSubmit && !busy}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
            {!hasWorkspace ? (
              <p className="text-xs text-muted-foreground">Select a workspace to start.</p>
            ) : (
              <SuggestionChips items={SUGGESTIONS} onPick={submit} disabled={busy} />
            )}
          </div>
        </section>
      ) : (
        <>
          <Conversation className="mt-4 min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-2xl gap-4 px-0">
              {kupeStore.turns.map((turn) => (
                <AskKupeTurn key={turn.id} turn={turn} />
              ))}
            </ConversationContent>
          </Conversation>
          <div className="mx-auto w-full max-w-2xl shrink-0 space-y-2 pb-2 pt-3">
            <ChatComposer
              value={prompt}
              onChange={setPrompt}
              onSend={() => submit(prompt)}
              placeholder="Ask anything… (Shift+Enter for new line)"
              disabled={!hasWorkspace}
              sending={busy}
              attachments={kupeStore.attachments}
              onAttach={(file) => void onAttach(file)}
              onRemoveAttachment={removeAttachment}
              rounded="full"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              onClick={() => resetSession()}
            >
              Start a new conversation
            </Button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
