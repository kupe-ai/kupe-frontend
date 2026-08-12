import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { BACKEND_URL } from "@/config";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type {
  Agent,
  AgentAnalysis,
  AgentConfig,
  AgentTool,
  AgentVersion,
  CatalogTool,
  Flow,
  PostCallAnalysis,
  ProvidersResponse,
} from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  orgId: string;
  projectId: string;
  agentId: string | null;
  onBack: () => void;
  onSaved: (agent: Agent) => void;
};

type Section = "identity" | "voice" | "features" | "attachments" | "history";

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: "identity", label: "Identity", hint: "Name, prompt, greeting" },
  { id: "voice", label: "Voice stack", hint: "LLM, STT, TTS, flow" },
  { id: "features", label: "Features", hint: "Saved in agent config" },
  { id: "attachments", label: "Attachments", hint: "Tools & analyses" },
  { id: "history", label: "History", hint: "Version snapshots" },
];

const DEFAULT_CONFIG: AgentConfig = {
  temperature: 0.5,
  max_tokens: 1024,
  language: "en",
  allow_interruptions: true,
  end_on_silence_ms: 0,
  max_call_duration_seconds: 0,
  record_calls: true,
};

const EMPTY_FORM = {
  name: "",
  system_prompt: "",
  greeting: "",
  llm_id: "",
  stt_id: "",
  tts_id: "",
  tts_voice_id: "",
  flow_id: "",
  config: { ...DEFAULT_CONFIG },
};

const PAGE_SIZE = 20;

function mergeConfig(raw: AgentConfig | Record<string, unknown> | null | undefined): AgentConfig {
  return { ...DEFAULT_CONFIG, ...(raw ?? {}) };
}

export function AgentBuilderPage({ orgId, projectId, agentId, onBack, onSaved }: Props) {
  const [section, setSection] = useState<Section>("identity");
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [orgAnalyses, setOrgAnalyses] = useState<PostCallAnalysis[]>([]);
  const [orgTools, setOrgTools] = useState<CatalogTool[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [attachedAnalyses, setAttachedAnalyses] = useState<AgentAnalysis[]>([]);
  const [attachedTools, setAttachedTools] = useState<AgentTool[]>([]);
  const [attachSelectId, setAttachSelectId] = useState("");
  const [attachToolId, setAttachToolId] = useState("");
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [versionsTotal, setVersionsTotal] = useState(0);
  const [versionsOffset, setVersionsOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(Boolean(agentId));

  useEffect(() => {
    fetch(`${BACKEND_URL}/v1/providers`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((res: ProvidersResponse) => setProviders(res))
      .catch(() => {});
    api.listAnalyses(orgId, { limit: 100 }).then((page) => setOrgAnalyses(page.items)).catch(() => {});
    api.listTools(orgId, { limit: 100 }).then((page) => setOrgTools(page.items)).catch(() => {});
    api.listFlows(orgId, projectId, { limit: 100 }).then((page) => setFlows(page.items)).catch(() => {});
  }, [orgId, projectId]);

  useEffect(() => {
    if (!agentId) {
      setAgent(null);
      setForm(EMPTY_FORM);
      setAttachedAnalyses([]);
      setAttachedTools([]);
      setVersions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getAgent(agentId)
      .then(async (found) => {
        setAgent(found);
        setForm({
          name: found.name,
          system_prompt: found.system_prompt,
          greeting: found.greeting ?? "",
          llm_id: found.llm_id,
          stt_id: found.stt_id,
          tts_id: found.tts_id,
          tts_voice_id: found.tts_voice_id ?? "",
          flow_id: found.flow_id ?? "",
          config: mergeConfig(found.config),
        });
        const [analyses, tools, vers] = await Promise.all([
          api.listAgentAnalyses(found.id, { limit: 100 }),
          api.listAgentTools(found.id, { limit: 100 }),
          api.listAgentVersions(found.id, { limit: PAGE_SIZE, offset: 0 }),
        ]);
        setAttachedAnalyses(analyses.items);
        setAttachedTools(tools.items);
        setVersions(vers.items);
        setVersionsTotal(vers.total);
        setVersionsOffset(0);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load agent"))
      .finally(() => setLoading(false));
  }, [agentId, orgId, projectId]);

  const ttsVoices = providers?.tts_providers.find((p) => p.id === form.tts_id);
  const availableToAttach = orgAnalyses.filter((a) => !attachedAnalyses.some((x) => x.id === a.id));
  const availableTools = orgTools.filter((t) => !attachedTools.some((x) => x.id === t.id));

  function patchConfig(patch: Partial<AgentConfig>) {
    setForm((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
  }

  async function refreshAttachments(id: string) {
    const [analyses, tools] = await Promise.all([
      api.listAgentAnalyses(id, { limit: 100 }),
      api.listAgentTools(id, { limit: 100 }),
    ]);
    setAttachedAnalyses(analyses.items);
    setAttachedTools(tools.items);
  }

  async function save() {
    if (!form.name.trim() || !form.system_prompt.trim() || !form.llm_id || !form.stt_id || !form.tts_id) {
      setError("Name, system prompt, LLM, STT, and TTS are required.");
      setSection("identity");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        system_prompt: form.system_prompt,
        greeting: form.greeting || null,
        llm_id: form.llm_id,
        stt_id: form.stt_id,
        tts_id: form.tts_id,
        tts_voice_id: form.tts_voice_id || null,
        flow_id: form.flow_id || null,
        config: form.config,
      };
      const saved = agent
        ? await api.updateAgent(agent.id, body)
        : await api.createAgent(orgId, projectId, body);
      setAgent(saved);
      setForm((prev) => ({ ...prev, config: mergeConfig(saved.config) }));
      onSaved(saved);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      if (saved.id) {
        const vers = await api.listAgentVersions(saved.id, { limit: PAGE_SIZE, offset: 0 });
        setVersions(vers.items);
        setVersionsTotal(vers.total);
        setVersionsOffset(0);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function loadVersions(id: string, offset: number) {
    const page = await api.listAgentVersions(id, { limit: PAGE_SIZE, offset });
    setVersions(page.items);
    setVersionsTotal(page.total);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading agent builder…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onBack} aria-label="Back to agents">
          <ArrowLeft className="h-4 w-4" />
          Agents
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {agent ? `Edit · ${form.name || agent.name}` : "New agent"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Post-call analyses attached here run automatically when a call with this agent ends.
          </p>
        </div>
        <Button className="cursor-pointer" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFlash ? <Check className="h-4 w-4" /> : null}
          {saving ? "Saving…" : savedFlash ? "Saved" : agent ? "Save changes" : "Create agent"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-4 mt-4 sm:mx-6" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b border-border p-3 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Builder sections">
          {SECTIONS.map((s, index) => {
            const locked = s.id === "attachments" || s.id === "history" ? !agent : false;
            return (
              <button
                key={s.id}
                type="button"
                disabled={locked}
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col rounded-md px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  section === s.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  locked && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {index + 1}/{SECTIONS.length}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
                <span className="hidden text-xs lg:block">{s.hint}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            {section === "identity" && (
              <>
                <SectionTitle title="Identity" description="How the agent presents itself on every call." />
                <Field label="Name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Support agent"
                  />
                </Field>
                <Field label="System prompt">
                  <Textarea
                    rows={8}
                    value={form.system_prompt}
                    onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                    placeholder="You are a helpful voice agent…"
                  />
                </Field>
                <Field label="Greeting (optional)">
                  <Input
                    value={form.greeting}
                    onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                    placeholder="Hi, how can I help you today?"
                  />
                </Field>
              </>
            )}

            {section === "voice" && (
              <>
                <SectionTitle title="Voice stack" description="Providers used for this agent’s live sessions." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="LLM">
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
                  </Field>
                  <Field label="STT">
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
                  </Field>
                  <Field label="TTS">
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
                  </Field>
                  <Field label="Voice">
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
                  </Field>
                  <Field label="Conversation flow (optional)" className="sm:col-span-2">
                    <Select
                      value={form.flow_id || "__none__"}
                      onValueChange={(v) => setForm({ ...form, flow_id: v === "__none__" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Linear conversation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Linear conversation</SelectItem>
                        {flows.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {section === "features" && (
              <>
                <SectionTitle
                  title="Features"
                  description="These knobs are stored on the agent config and versioned with each save."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Temperature">
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={form.config.temperature ?? 0.5}
                      onChange={(e) => patchConfig({ temperature: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Max tokens">
                    <Input
                      type="number"
                      min={64}
                      max={8192}
                      step={64}
                      value={form.config.max_tokens ?? 1024}
                      onChange={(e) => patchConfig({ max_tokens: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Language">
                    <Input
                      value={form.config.language ?? "en"}
                      onChange={(e) => patchConfig({ language: e.target.value })}
                      placeholder="en"
                    />
                  </Field>
                  <Field label="End on silence (ms, 0 = off)">
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={form.config.end_on_silence_ms ?? 0}
                      onChange={(e) => patchConfig({ end_on_silence_ms: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Max call duration (seconds, 0 = off)" className="sm:col-span-2">
                    <Input
                      type="number"
                      min={0}
                      step={30}
                      value={form.config.max_call_duration_seconds ?? 0}
                      onChange={(e) => patchConfig({ max_call_duration_seconds: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <Checkbox
                    checked={form.config.allow_interruptions !== false}
                    onCheckedChange={(v) => patchConfig({ allow_interruptions: v === true })}
                  />
                  <span>
                    <span className="font-medium">Allow interruptions</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Caller can barge in while the agent is speaking.
                    </span>
                  </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <Checkbox
                    checked={form.config.record_calls !== false}
                    onCheckedChange={(v) => patchConfig({ record_calls: v === true })}
                  />
                  <span>
                    <span className="font-medium">Record calls by default</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Prefer recording when the transport supports it.
                    </span>
                  </span>
                </label>
              </>
            )}

            {section === "attachments" && agent && (
              <>
                <SectionTitle
                  title="Attachments"
                  description="Tools run live; post-call analyses run automatically when a call with this agent ends."
                />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Tools</h3>
                  <div className="flex flex-wrap gap-2">
                    <Select value={attachToolId || undefined} onValueChange={setAttachToolId}>
                      <SelectTrigger className="min-w-[220px] flex-1">
                        <SelectValue placeholder="Select tool" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTools.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="cursor-pointer"
                      disabled={!attachToolId}
                      onClick={() =>
                        void api.attachAgentTool(agent.id, attachToolId, true).then(async () => {
                          setAttachToolId("");
                          await refreshAttachments(agent.id);
                        })
                      }
                    >
                      Add tool
                    </Button>
                  </div>
                  {attachedTools.map((tool) => (
                    <div key={tool.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{tool.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => void api.detachAgentTool(agent.id, tool.id).then(() => refreshAttachments(agent.id))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">Post-call analyses</h3>
                  <p className="text-xs text-muted-foreground">
                    Attach analyses here — not on the dial screen. Enabled analyses run after every call.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Select value={attachSelectId || undefined} onValueChange={setAttachSelectId}>
                      <SelectTrigger className="min-w-[220px] flex-1">
                        <SelectValue placeholder="Select analysis" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAttach.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="cursor-pointer"
                      disabled={!attachSelectId}
                      onClick={() =>
                        void api.attachAnalysis(agent.id, attachSelectId, true).then(async () => {
                          setAttachSelectId("");
                          await refreshAttachments(agent.id);
                        })
                      }
                    >
                      Attach analysis
                    </Button>
                  </div>
                  {attachedAnalyses.length === 0 && (
                    <p className="text-sm text-muted-foreground">No analyses attached yet.</p>
                  )}
                  {attachedAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <label className="flex min-h-11 cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={analysis.enabled}
                          onCheckedChange={(checked) =>
                            void api.attachAnalysis(agent.id, analysis.id, checked === true).then(() =>
                              refreshAttachments(agent.id),
                            )
                          }
                        />
                        <span>{analysis.name}</span>
                      </label>
                      <span className={`text-xs ${analysis.enabled ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {analysis.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto cursor-pointer"
                        onClick={() =>
                          void api.detachAnalysis(agent.id, analysis.id).then(() => refreshAttachments(agent.id))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {section === "history" && agent && (
              <>
                <SectionTitle title="Version history" description="Revert to an earlier saved snapshot." />
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      v{v.version} — {new Date(v.created_at).toLocaleString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() =>
                        void api.revertAgent(agent.id, v.version).then((updated) => {
                          setAgent(updated);
                          setForm({
                            name: updated.name,
                            system_prompt: updated.system_prompt,
                            greeting: updated.greeting ?? "",
                            llm_id: updated.llm_id,
                            stt_id: updated.stt_id,
                            tts_id: updated.tts_id,
                            tts_voice_id: updated.tts_voice_id ?? "",
                            flow_id: updated.flow_id ?? "",
                            config: mergeConfig(updated.config),
                          });
                          onSaved(updated);
                        })
                      }
                    >
                      Revert
                    </Button>
                  </div>
                ))}
                <PaginationControls
                  total={versionsTotal}
                  limit={PAGE_SIZE}
                  offset={versionsOffset}
                  onPageChange={(next) => {
                    setVersionsOffset(next);
                    void loadVersions(agent.id, next);
                  }}
                />
                <Button
                  variant="outline"
                  className="cursor-pointer text-destructive"
                  onClick={() =>
                    void api.archiveAgent(agent.id).then(() => {
                      onBack();
                    })
                  }
                >
                  Archive agent
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
