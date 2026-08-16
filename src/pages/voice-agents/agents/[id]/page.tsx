"use client";

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/voice-agents/agent-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VoiceEditorShimmer } from "@/components/ui/shimmer";
import { AgentAskKoriPanel } from "@/components/voice-agents/agent-ask-kori-panel";
import { SystemPromptSection } from "@/components/voice-agents/system-prompt-section";
import { AgentSettingsPanel } from "@/components/voice-agents/agent-settings-panel";
import { AgentTestsPanel } from "@/components/voice-agents/agent-tests-panel";
import { AgentToolsPanel } from "@/components/voice-agents/agent-tools-panel";
import { AgentTransferPanel } from "@/components/voice-agents/agent-transfer-panel";
import { AgentVariablesPanel } from "@/components/voice-agents/agent-variables-panel";
import { TestAgentCallDialog } from "@/components/voice-agents/test-agent-call-dialog";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { useKoriQuery } from "@/lib/hooks/use-kori-query";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { AGENT_EDITOR_NAV, type AgentEditorSection } from "@/lib/voice-agent-editor-data";
import {
  commitVoiceAgentVersion,
  duplicateVoiceAgent,
  exportVoiceAgent,
  getVoiceAgent,
  updateVoiceAgent,
} from "@/lib/api/voice/agents";
import type { VoiceAgent } from "@/lib/api/voice/types";

export default function VoiceAgentEditorPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<AgentEditorSection>("instructions");
  const [testOpen, setTestOpen] = useState(false);
  const [instructionsSeed, setInstructionsSeed] = useState(0);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const agentQuery = useKoriQuery({
    queryKey: ["voice-agent", id],
    queryFn: () => getVoiceAgent(id),
    enabled: Boolean(id),
  });

  const agent = agentQuery.data ?? null;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["voice-agent", id] });
    setInstructionsSeed((n) => n + 1);
  }, [queryClient, id]);

  useEffect(() => {
    if (agent?.name) document.title = `${agent.name} · Voice Agents · Kupe`;
  }, [agent?.name]);

  async function savePromptField(patch: Partial<VoiceAgent>) {
    if (!agent) return;
    if (patch.system_prompt != null && patch.system_prompt === agent.system_prompt) return;
    if (
      patch.first_message !== undefined &&
      (patch.first_message ?? "") === (agent.first_message ?? "")
    ) {
      return;
    }
    setSavingPrompt(true);
    try {
      await updateVoiceAgent(id, patch);
      await queryClient.invalidateQueries({ queryKey: ["voice-agent", id] });
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't save prompt"));
    } finally {
      setSavingPrompt(false);
    }
  }

  async function commit() {
    try {
      const version = await commitVoiceAgentVersion(id);
      toast.success(`Committed as v${(version as { version?: number }).version ?? ""}`);
      void refresh();
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't commit agent"));
    }
  }

  async function duplicate() {
    try {
      const copy = await duplicateVoiceAgent(id);
      toast.success(`Duplicated as “${copy.name}”`);
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't duplicate agent"));
    }
  }

  async function exportAgent() {
    try {
      const data = await exportVoiceAgent(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${agent?.name ?? "agent"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't export agent"));
    }
  }

  if (agentQuery.isLoading && !agent) {
    return <VoiceEditorShimmer />;
  }

  if (agentQuery.isError || !agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm font-medium">Couldn't load this agent</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {friendlyVoiceError(agentQuery.error, "It may have been deleted or you don't have access.")}
        </p>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/agents">Back to agents</Link>
        </Button>
      </div>
    );
  }

  const seed = agent.avatar_seed;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" asChild aria-label="Back to agents">
            <Link to="/agents">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <AgentAvatar seed={seed} size={28} className="rounded-md" />
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="truncate font-semibold">{agent.name}</span>
            <span className="text-muted-foreground">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  v{agent.current_version}
                  <StatusChip status={agent.status} />
                  <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => void commit()}>
                  <Plus className="size-4" />
                  Commit agent
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
            {savingPrompt ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Saving" />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button type="button" size="sm" className="rounded-full" onClick={() => setTestOpen(true)}>
            <Phone className="size-3.5" />
            Test agent
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void duplicate()}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportAgent()}>Export</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[152px] shrink-0 flex-col gap-0.5 border-r border-border bg-pane px-2 py-3 md:w-[168px]">
          {AGENT_EDITOR_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  section === item.id
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {section === "instructions" && (
            <SystemPromptSection
              key={`${id}-${instructionsSeed}`}
              systemPrompt={agent.system_prompt}
              firstMessage={agent.first_message ?? ""}
              onSystemPromptChange={(value) => void savePromptField({ system_prompt: value })}
              onFirstMessageChange={(value) => void savePromptField({ first_message: value })}
            />
          )}
          {section === "variables" && <AgentVariablesPanel agentId={id} />}
          {section === "tools" && <AgentToolsPanel agentId={id} />}
          {section === "transfer" && <AgentTransferPanel agentId={id} />}
          {section === "settings" && (
            <AgentSettingsPanel agentId={id} agent={agent} onAgentUpdated={refresh} />
          )}
          {section === "tests" && <AgentTestsPanel agentId={id} seed={seed} />}
        </div>

        <div className="hidden h-full min-h-0 w-[320px] shrink-0 md:flex xl:w-[360px]">
          <AgentAskKoriPanel
            agentId={id}
            agentName={agent.name}
            onAgentChanged={() => void refresh()}
          />
        </div>
      </div>

      <TestAgentCallDialog open={testOpen} onOpenChange={setTestOpen} agentId={id} agentName={agent.name} seed={seed} />
    </div>
  );
}
