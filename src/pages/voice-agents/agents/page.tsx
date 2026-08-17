"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
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

export default function VoiceAgentsAgentsPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState<"prompt" | "scratch" | null>(null);

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

  const busy = creating !== null;
  const canSubmit = prompt.trim().length > 0 && !busy;

  async function submitPrompt() {
    const text = prompt.trim();
    if (!text) {
      toast.message("Describe what your agent should do");
      return;
    }
    setCreating("prompt");
    try {
      const agent = await createVoiceAgent({ prompt: text });
      refreshRecents();
      navigate(`/agents/${agent.id}`);
    } catch {
      toast.error("Couldn't create agent");
    } finally {
      setCreating(null);
    }
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

  if (agentsQuery.isLoading && !agentsQuery.data) {
    return <VoiceAgentsPageShimmer />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6">
      <VoicePageHeader
        title="Agents"
        actions={
          <Button
            className="group/nav rounded-full"
            onClick={() => void createFromScratch()}
            loading={creating === "scratch"}
            disabled={busy}
          >
            <KupeIcon name="plus" className="size-4" />
            Create from scratch
          </Button>
        }
      />

      <section className="mt-10 flex flex-col items-center text-center">
        <AgentAvatar muted size={64} alt="" className="text-neutral-500 opacity-60 dark:text-neutral-400" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          What should your voice agent do?
        </h1>
        <div className="group/nav mt-5 flex w-full max-w-2xl items-center rounded-full border border-input bg-background shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <KupeIcon
            name="phone"
            className="ml-4 size-4 text-muted-foreground"
          />
          <div className="relative min-w-0 flex-1 text-left">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitPrompt();
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
            onClick={() => void submitPrompt()}
            aria-label="Create agent from prompt"
            loading={creating === "prompt"}
            disabled={!canSubmit && creating !== "prompt"}
          >
            <ArrowUp className="size-4" />
          </Button>
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
