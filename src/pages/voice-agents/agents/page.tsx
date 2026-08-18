"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  AgentTemplatesSection,
  RecentAgentsTable,
  VoicePageHeader,
} from "@/components/voice-agents/shared";
import { CyclingPromptPlaceholder } from "@/components/voice-agents/cycling-prompt";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { Button } from "@/components/ui/button";
import { VoiceAgentsPageShimmer } from "@/components/ui/shimmer";
import { useKoriQuery } from "@/lib/hooks/use-kori-query";
import { createVoiceAgent, listVoiceAgents } from "@/lib/api/voice/agents";
import type { RecentVoiceAgent } from "@/lib/voice-agents-data";
import { useWorkspace } from "@/context/workspace-context";
import {
  clearCreatedAgent,
  removeAttachment,
  sendForNewAgent,
  uploadAttachment,
} from "@/lib/ask-ai/kupe-agent-store";
import { useKupeAgentStore } from "@/lib/ask-ai/use-kupe-agent-store";
import { sanitizeChatError } from "@/lib/ask-ai/public-error";
import { AskAiToolbarButton } from "@/components/ask-ai/ask-ai-toolbar-button";
import { AttachmentChips, SuggestionChips } from "@/components/ask-ai/chat-composer";

const CREATE_SUGGESTIONS = [
  "Create a collections agent",
  "EMI reminder agent",
  "Lead qualification",
  "Cart recovery",
];

export default function VoiceAgentsAgentsPage() {
  const navigate = useNavigate();
  const { org, project } = useWorkspace();
  const kupeStore = useKupeAgentStore();
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState<"prompt" | "scratch" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sawBusy = useRef(false);

  const agentsQuery = useKoriQuery({
    queryKey: ["voice-agents", "list"],
    queryFn: () => listVoiceAgents({ page_size: 50 }),
  });

  useEffect(() => {
    document.title = "Agents · Voice Agents · Kupe";
  }, []);

  const recentAgents: RecentVoiceAgent[] = (agentsQuery.data?.items ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email ?? "",
    seed: a.avatar_seed,
    lastEdited: new Date(a.updated_at).toLocaleDateString(),
    lastEditedAt: new Date(a.updated_at).getTime(),
  }));

  const refreshRecents = useCallback(() => {
    void agentsQuery.refetch();
  }, [agentsQuery]);

  useEffect(() => {
    if (kupeStore.createdAgent && creating === "prompt") {
      const id = kupeStore.createdAgent.id;
      clearCreatedAgent();
      setCreating(null);
      refreshRecents();
      navigate(`/agents/${id}`);
    }
  }, [kupeStore.createdAgent, creating, navigate, refreshRecents]);

  useEffect(() => {
    if (kupeStore.busy) sawBusy.current = true;
    if (creating !== "prompt" || !sawBusy.current || kupeStore.busy || kupeStore.createdAgent || kupeStore.scopeAgentId) {
      return;
    }
    sawBusy.current = false;
    setCreating(null);
    toast.error(kupeStore.error ? sanitizeChatError(kupeStore.error) : "Kupe couldn't create that agent — try describing it differently");
  }, [creating, kupeStore.busy, kupeStore.createdAgent, kupeStore.scopeAgentId, kupeStore.error]);

  const busy = creating !== null;
  const canSubmit = (prompt.trim().length > 0 || kupeStore.attachments.length > 0) && !busy;

  function submitPrompt(text = prompt) {
    const trimmed = text.trim();
    if (!trimmed && kupeStore.attachments.length === 0) {
      toast.message("Describe what your agent should do");
      return;
    }
    if (!org?.id || !project?.id) {
      toast.error("Select an organization and project first");
      return;
    }
    if (kupeStore.busy) {
      toast.message("Kupe is still working on the last request");
      return;
    }
    sawBusy.current = false;
    setCreating("prompt");
    setPrompt("");
    void sendForNewAgent(org.id, project.id, trimmed || "Create an agent from the attached file.");
  }

  async function createFromScratch() {
    setCreating("scratch");
    try {
      const agent = await createVoiceAgent({ name: "New agent" });
      refreshRecents();
      navigate(`/agents/${agent.id}`);
    } catch {
      toast.error("Couldn't create agent");
    } finally {
      setCreating(null);
    }
  }

  async function onAttach(file: File) {
    if (!org?.id) {
      toast.error("Select an organization first");
      return;
    }
    try {
      await uploadAttachment(org.id, file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (agentsQuery.isLoading && !agentsQuery.data) {
    return <VoiceAgentsPageShimmer />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6">
      <VoicePageHeader
        title="Agents"
        actions={
          <div className="flex items-center gap-2">
            <AskAiToolbarButton label="Ask Kupe" />
            <Button
              className="group/nav rounded-full"
              onClick={() => void createFromScratch()}
              loading={creating === "scratch"}
              disabled={busy}
            >
              <KupeIcon name="plus" className="size-4" />
              Create from scratch
            </Button>
          </div>
        }
      />

      <section className="mt-10 flex flex-col items-center text-center">
        <AgentAvatar muted size={64} alt="" className="text-neutral-500 opacity-60 dark:text-neutral-400" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          What should your voice agent do?
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
              disabled={busy}
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
                  if (e.key === "Enter") submitPrompt();
                }}
                className="h-12 w-full min-w-0 rounded-full border-0 bg-transparent px-3 text-left text-sm outline-none placeholder:text-muted-foreground md:h-14 md:text-base"
                placeholder={focused && !prompt ? "Create a voice agent…" : undefined}
                aria-label="Describe your voice agent"
                disabled={busy}
              />
              {!prompt && !focused ? <CyclingPromptPlaceholder paused={busy} /> : null}
            </div>
            <Button
              type="button"
              size="icon"
              className="mr-1.5 size-9 shrink-0 rounded-full"
              onClick={() => submitPrompt()}
              aria-label="Create agent from prompt"
              loading={creating === "prompt"}
              disabled={!canSubmit && creating !== "prompt"}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <SuggestionChips items={CREATE_SUGGESTIONS} onPick={submitPrompt} disabled={busy} />
        </div>
      </section>

      {recentAgents.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-1 text-base font-semibold tracking-tight">Recents</h2>
          <RecentAgentsTable agents={recentAgents} onChanged={refreshRecents} />
        </section>
      ) : null}

      <div className="mt-8 pb-8">
        <AgentTemplatesSection />
      </div>
    </div>
  );
}
