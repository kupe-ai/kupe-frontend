import { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Agent } from "./types";

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
      .listAgents(orgId, projectId)
      .then(setAgents)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load agents"));
  }, [orgId, projectId]);

  const selected = agents?.find((a) => a.id === agentId) ?? null;

  return (
    <div className="agent-picker">
      <label>
        Agent
        <select
          value={agentId ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">No agent — pick providers manually</option>
          {(agents ?? []).map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} (v{agent.version})
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <p className="transcript-empty">
          Runs {selected.llm_id} / {selected.stt_id} / {selected.tts_id} with this agent&apos;s
          prompt and its attached post-call analyses.
        </p>
      )}
      {!selected && agents?.length === 0 && (
        <p className="transcript-empty">
          No agents in this project yet — create one on the Agents tab to get transcripts and
          post-call analysis for a call.
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
