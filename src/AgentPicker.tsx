import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  orgId: string;
  projectId: string;
  agentId: string | null;
  onChange: (agentId: string | null) => void;
};

/** Lets a session start from a saved agent. Picking one sends `agent_id` and
 * nothing else: the backend resolves providers, system prompt, greeting, voice
 * and attached post-call analyses from the agent and snapshots them onto the
 * session, so the UI must not also send raw provider ids.
 */
export default function AgentPicker({ orgId, projectId, agentId, onChange }: Props) {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAgents(orgId, projectId, { limit: 100 })
      .then((page) => setAgents(page.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load agents"));
  }, [orgId, projectId]);

  const selected = agents?.find((a) => a.id === agentId) ?? null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Agent</Label>
        <Select
          value={agentId ?? "__none__"}
          onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="No agent — pick providers manually" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No agent — pick providers manually</SelectItem>
            {(agents ?? []).map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name} (v{agent.version})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Runs {selected.llm_id} / {selected.stt_id} / {selected.tts_id} with this agent&apos;s prompt
          and its attached post-call analyses.
        </p>
      )}
      {!selected && agents?.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No agents in this project yet — create one on the Agents tab to get transcripts and
          post-call analysis for a call.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
