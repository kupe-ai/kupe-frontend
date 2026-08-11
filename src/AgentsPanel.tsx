import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/config";
import { api } from "@/lib/api";
import type { Agent, AgentVersion, PostCallAnalysis, ProvidersResponse } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit agent" : "Create agent"}</CardTitle>
          <CardDescription>Configure prompt, greeting, and provider stack.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>System prompt</Label>
            <Textarea
              rows={5}
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Greeting (optional)</Label>
            <Input value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>LLM</Label>
              <Select value={form.llm_id || undefined} onValueChange={(v) => setForm({ ...form, llm_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select LLM" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.model_providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.provider_name} / {p.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>STT</Label>
              <Select value={form.stt_id || undefined} onValueChange={(v) => setForm({ ...form, stt_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select STT" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.transcriber_providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.provider_name} / {p.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>TTS</Label>
              <Select
                value={form.tts_id || undefined}
                onValueChange={(v) => setForm({ ...form, tts_id: v, tts_voice_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select TTS" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.tts_providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.provider_name} / {p.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={form.tts_voice_id || "__default__"}
                onValueChange={(v) => setForm({ ...form, tts_voice_id: v === "__default__" ? "" : v })}
                disabled={!ttsVoices?.voices?.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default voice</SelectItem>
                  {ttsVoices?.voices?.map((v) => (
                    <SelectItem key={v.voice_id} value={v.voice_id}>
                      {v.voice_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void submit()}>{editingId ? "Save" : "Create agent"}</Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agents</CardTitle>
            <CardDescription>Select an agent to manage analyses and versions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agents.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
            {agents.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                <Button
                  variant={selectedAgent?.id === a.id ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => void selectAgent(a)}
                >
                  {a.name}
                </Button>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
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
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void api.archiveAgent(a.id).then(refresh)}>
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {selectedAgent && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedAgent.name}</CardTitle>
              <CardDescription>Post-call analyses and version history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium">Analyses</div>
                {orgAnalyses.map((analysis) => {
                  const attached = attachedAnalyses.some((a) => a.id === analysis.id);
                  return (
                    <label key={analysis.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={attached}
                        onCheckedChange={(checked) => void toggleAnalysis(analysis, checked === true)}
                      />
                      {analysis.name}
                    </label>
                  );
                })}
                {orgAnalyses.length === 0 && (
                  <p className="text-sm text-muted-foreground">No analyses defined yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">History</div>
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    <span>
                      v{v.version} — {new Date(v.created_at).toLocaleString()}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => void revert(v.version)}>
                      Revert
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
