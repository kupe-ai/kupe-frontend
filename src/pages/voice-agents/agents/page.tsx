"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AgentTemplatesSection,
  RecentAgentsTable,
  VoicePageHeader,
} from "@/components/voice-agents/shared";
import { AiStar } from "@/components/brand/ai-star";
import { Button } from "@/components/ui/button";
import { VoiceAgentsPageShimmer } from "@/components/ui/shimmer";
import { useKoriQuery } from "@/lib/hooks/use-kori-query";
import { createVoiceAgent, listVoiceAgents } from "@/lib/api/voice/agents";
import type { RecentVoiceAgent } from "@/lib/voice-agents-data";

export default function VoiceAgentsAgentsPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(
    "Create a voice agent to answer calls and confirm appointments",
  );
  const [creating, setCreating] = useState(false);

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

  async function submitPrompt() {
    const text = prompt.trim();
    if (!text) {
      toast.message("Describe what your agent should do");
      return;
    }
    setCreating(true);
    try {
      const agent = await createVoiceAgent({ prompt: text });
      refreshRecents();
      navigate(`/agents/${agent.id}`);
    } catch {
      toast.error("Couldn't create agent");
    } finally {
      setCreating(false);
    }
  }

  async function createFromScratch() {
    setCreating(true);
    try {
      const agent = await createVoiceAgent({ name: "New agent" });
      refreshRecents();
      navigate(`/agents/${agent.id}`);
    } catch {
      toast.error("Couldn't create agent");
    } finally {
      setCreating(false);
    }
  }

  if (agentsQuery.isLoading && !agentsQuery.data) {
    return <VoiceAgentsPageShimmer />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
      <VoicePageHeader
        title="Agents"
        actions={
          <Button className="rounded-full" onClick={() => void createFromScratch()} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create from scratch
          </Button>
        }
      />

      <section className="mt-10 flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <AiStar size={28} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          What should your voice agent do?
        </h1>
        <div className="mt-5 flex w-full max-w-2xl items-center rounded-full border border-input bg-background shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitPrompt();
            }}
            className="h-12 min-w-0 flex-1 rounded-full border-0 bg-transparent px-5 text-sm outline-none md:h-14 md:text-base"
            aria-label="Describe your voice agent"
            disabled={creating}
          />
          <Button
            type="button"
            size="icon"
            className="mr-1.5 size-9 shrink-0 rounded-full"
            onClick={() => void submitPrompt()}
            aria-label="Create agent from prompt"
            disabled={creating}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight">Recents</h2>
        <RecentAgentsTable agents={recentAgents} onChanged={refreshRecents} />
      </section>

      <div className="mt-8 pb-8">
        <AgentTemplatesSection />
      </div>
    </div>
  );
}
