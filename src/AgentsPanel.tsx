import { useEffect, useState } from "react";
import { BACKEND_URL } from "./config";
import { api } from "./lib/api";
import type { Agent, AgentVersion, PostCallAnalysis, ProvidersResponse } from "./types";

type Props = { orgId: string; projectId: string };

const EMPTY_FORM = {
  name: "",
  system_prompt: "",
  greeting: "",
  llm_id: "",
  stt_id: "",
  tts_id: "",
  tts_voice_id: "",
};

export function AgentsPanel({ orgId, projectId }: Props) {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orgAnalyses, setOrgAnalyses] = useState<PostCallAnalysis[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [attachedAnalyses, setAttachedAnalyses] = useState<PostCallAnalysis[]>([]);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    api.listAgents(orgId, projectId).then(setAgents).catch((e) => setError(e.message));
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/v1/providers`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((res: ProvidersResponse) => setProviders(res))
      .catch(() => {});
    refresh();
    api.listAnalyses(orgId).then(setOrgAnalyses).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, projectId]);

  const ttsVoices = providers?.tts_providers.find((p) => p.id === form.tts_id);

  async function submit() {
    try {
      const body = { ...form, tts_voice_id: form.tts_voice_id || null };
      if (editingId) {
        await api.updateAgent(editingId, body);
      } else {
        await api.createAgent(orgId, projectId, body);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function selectAgent(agent: Agent) {
    setSelectedAgent(agent);
    setAttachedAnalyses(await api.listAgentAnalyses(agent.id));
    setVersions(await api.listAgentVersions(agent.id));
  }

  async function toggleAnalysis(analysis: PostCallAnalysis, attach: boolean) {
    if (!selectedAgent) return;
    if (attach) await api.attachAnalysis(selectedAgent.id, analysis.id);
    else await api.detachAnalysis(selectedAgent.id, analysis.id);
    setAttachedAnalyses(await api.listAgentAnalyses(selectedAgent.id));
  }

  async function revert(version: number) {
    if (!selectedAgent) return;
    const updated = await api.revertAgent(selectedAgent.id, version);
    refresh();
    selectAgent(updated);
  }

  return (
    <div className="panel">
      <h2>Agents</h2>
      {error && <p className="error">{error}</p>}

      <div className="agent-form">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <textarea
          placeholder="System prompt"
          value={form.system_prompt}
          onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
        />
        <input
          placeholder="Greeting (optional)"
          value={form.greeting}
          onChange={(e) => setForm({ ...form, greeting: e.target.value })}
        />
        <select value={form.llm_id} onChange={(e) => setForm({ ...form, llm_id: e.target.value })}>
          <option value="">LLM…</option>
          {providers?.model_providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.provider_name} / {p.model_name}
            </option>
          ))}
        </select>
        <select value={form.stt_id} onChange={(e) => setForm({ ...form, stt_id: e.target.value })}>
          <option value="">STT…</option>
          {providers?.transcriber_providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.provider_name} / {p.model_name}
            </option>
          ))}
        </select>
        <select
          value={form.tts_id}
          onChange={(e) => setForm({ ...form, tts_id: e.target.value, tts_voice_id: "" })}
        >
          <option value="">TTS…</option>
          {providers?.tts_providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.provider_name} / {p.model_name}
            </option>
          ))}
        </select>
        <select
          value={form.tts_voice_id}
          onChange={(e) => setForm({ ...form, tts_voice_id: e.target.value })}
          disabled={!ttsVoices?.voices?.length}
        >
          <option value="">Default voice</option>
          {ttsVoices?.voices?.map((v) => (
            <option key={v.voice_id} value={v.voice_id}>
              {v.voice_name}
            </option>
          ))}
        </select>
        <button onClick={submit}>{editingId ? "Save" : "Create agent"}</button>
      </div>

      <ul className="agent-list">
        {agents.map((a) => (
          <li key={a.id}>
            <button onClick={() => selectAgent(a)}>{a.name}</button>
            <button
              onClick={() => {
                setEditingId(a.id);
                setForm({
                  name: a.name,
                  system_prompt: a.system_prompt,
                  greeting: a.greeting ?? "",
                  llm_id: a.llm_id,
                  stt_id: a.stt_id,
                  tts_id: a.tts_id,
                  tts_voice_id: a.tts_voice_id ?? "",
                });
              }}
            >
              Edit
            </button>
            <button onClick={() => api.archiveAgent(a.id).then(refresh)}>Archive</button>
          </li>
        ))}
      </ul>

      {selectedAgent && (
        <div className="agent-detail">
          <h3>{selectedAgent.name} — post-call analyses</h3>
          <ul>
            {orgAnalyses.map((analysis) => {
              const attached = attachedAnalyses.some((a) => a.id === analysis.id);
              return (
                <li key={analysis.id}>
                  <label>
                    <input type="checkbox" checked={attached} onChange={(e) => toggleAnalysis(analysis, e.target.checked)} />
                    {analysis.name}
                  </label>
                </li>
              );
            })}
          </ul>

          <h3>History</h3>
          <ul>
            {versions.map((v) => (
              <li key={v.version}>
                v{v.version} — {new Date(v.created_at).toLocaleString()}
                <button onClick={() => revert(v.version)}>Revert to this version</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
