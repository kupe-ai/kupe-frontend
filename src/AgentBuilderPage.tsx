import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { BACKEND_URL } from "@/config";
import { FlowCanvas, EMPTY_FLOW } from "@/FlowCanvas";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CallTransferCard } from "@/CallTransferCard";
import { api } from "@/lib/api";
import { captureEvent } from "@/lib/posthog";
import { listVoiceTtsVoices } from "@/lib/api/voice/providers";
import { formatProviderModel } from "@/lib/voice/provider-brand";
import type {
  Agent,
  AgentAnalysis,
  AgentConfig,
  AgentTool,
  AgentVersion,
  AmbientPreset,
  AudioAsset,
  CatalogTool,
  CatalogVoice,
  FlowDefinition,
  NoiseCancellation,
  PostCallAnalysis,
  ProvidersResponse,
  ThinkingSoundsConfig,
} from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  orgId: string;
  projectId: string;
  agentId: string | null;
  onBack: () => void;
  onSaved: (agent: Agent) => void;
};

type Section = "identity" | "voice" | "flow" | "features" | "attachments" | "history";

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: "identity", label: "Identity", hint: "Name, prompt, greeting" },
  { id: "voice", label: "Voice stack", hint: "LLM, STT, TTS" },
  { id: "flow", label: "Flow", hint: "Conversation graph" },
  { id: "features", label: "Features", hint: "Turns, audio, tools" },
  { id: "attachments", label: "Attachments", hint: "Post-call analyses" },
  { id: "history", label: "History", hint: "Version snapshots" },
];

const DEFAULT_CONFIG: AgentConfig = {
  llm: {
    temperature: 0.5,
    max_tokens: 1024,
    language: "hi",
    allowed_languages: ["en", "hi", "gu"],
    multilingual_enabled: true,
    auto_detect_language: true,
    output_numbers_indic: false,
    switch_after_seconds: null,
  },
  tts: { speaking_speed: 1.0, pitch: 0 },
  session: { max_duration_seconds: 180, allow_interruptions: true, record_calls: true },
  turn: { vad_stop_secs: 0.2, eagerness: 5, volume_threshold_db: -30 },
  audio: {
    noise_cancellation: "medium",
    background_noise: { enabled: false, source: "preset", id: "office", volume: 0.25 },
  },
  end_of_call_warning: {
    enabled: false,
    warn_before_seconds: 30,
    mode: "simple",
    simple_message: "This call will end in {remaining_seconds} seconds.",
    session_aware_template:
      "Just a heads up — we have about {remaining_seconds} seconds left in this {duration_seconds}-second call with {agent_name}.",
  },
  silence_breaker: { enabled: false, idle_seconds: 8, messages: [], hangup_after_unanswered: false },
  thinking_sounds: { mode: "off", enabled: false },
  voicemail_detection: {
    enabled: true,
    message: "Sorry we missed you. Please call us back when you can.",
    response_delay: 2,
  },
  auto_cut: { enabled: false, mode: "warm" },
  call_transfer: { enabled: false, destinations: [] },
  memory: { enabled: true, retention_days: 30, max_calls: 5, scope: "agent" },
  dynamic_greeting: { enabled: false, instructions: "" },
  variables: [],
};

const EMPTY_FORM = {
  name: "",
  system_prompt: "",
  greeting: "",
  llm_id: "",
  stt_id: "",
  tts_id: "",
  tts_voice_id: "",
  flow_definition: { ...EMPTY_FLOW } as FlowDefinition,
  config: structuredClone(DEFAULT_CONFIG),
};

const PAGE_SIZE = 20;

/** Agents saved before the three-way control only carry the old boolean. */
function normalizeThinkingSounds(raw: ThinkingSoundsConfig | undefined): ThinkingSoundsConfig {
  const mode = raw?.mode ?? (raw?.enabled ? "sounds" : DEFAULT_CONFIG.thinking_sounds.mode);
  return { mode, enabled: mode !== "off" };
}

function mergeConfig(raw: AgentConfig | Record<string, unknown> | null | undefined): AgentConfig {
  const data = (raw ?? {}) as Record<string, unknown>;
  const legacy = data as Record<string, unknown>;
  const llm = (data.llm as AgentConfig["llm"] | undefined) ?? {
    temperature: typeof legacy.temperature === "number" ? legacy.temperature : DEFAULT_CONFIG.llm.temperature,
    max_tokens: typeof legacy.max_tokens === "number" ? legacy.max_tokens : DEFAULT_CONFIG.llm.max_tokens,
    language: typeof legacy.language === "string" ? legacy.language : DEFAULT_CONFIG.llm.language,
  };
  const session = (data.session as AgentConfig["session"] | undefined) ?? {
    max_duration_seconds:
      typeof legacy.max_call_duration_seconds === "number"
        ? legacy.max_call_duration_seconds
        : DEFAULT_CONFIG.session.max_duration_seconds,
    allow_interruptions:
      typeof legacy.allow_interruptions === "boolean"
        ? legacy.allow_interruptions
        : DEFAULT_CONFIG.session.allow_interruptions,
    record_calls:
      typeof legacy.record_calls === "boolean" ? legacy.record_calls : DEFAULT_CONFIG.session.record_calls,
  };
  return {
    llm: { ...DEFAULT_CONFIG.llm, ...llm },
    tts: {
      speaking_speed:
        typeof (data.tts as { speaking_speed?: number } | undefined)?.speaking_speed === "number"
          ? (data.tts as { speaking_speed: number }).speaking_speed
          : 1.0,
      pitch:
        typeof (data.tts as { pitch?: number } | undefined)?.pitch === "number"
          ? (data.tts as { pitch: number }).pitch
          : 0,
    },
    session: { ...DEFAULT_CONFIG.session, ...session },
    turn: {
      ...DEFAULT_CONFIG.turn,
      ...((data.turn as AgentConfig["turn"]) ?? {}),
    },
    audio: {
      ...DEFAULT_CONFIG.audio,
      ...((data.audio as Partial<AgentConfig["audio"]>) ?? {}),
      background_noise: {
        ...DEFAULT_CONFIG.audio.background_noise,
        ...(((data.audio as AgentConfig["audio"] | undefined)?.background_noise) ?? {}),
      },
    },
    end_of_call_warning: {
      ...DEFAULT_CONFIG.end_of_call_warning,
      ...((data.end_of_call_warning as AgentConfig["end_of_call_warning"]) ?? {}),
    },
    silence_breaker: {
      ...DEFAULT_CONFIG.silence_breaker,
      ...((data.silence_breaker as AgentConfig["silence_breaker"]) ?? {}),
    },
    thinking_sounds: normalizeThinkingSounds(data.thinking_sounds as ThinkingSoundsConfig | undefined),
    voicemail_detection: {
      ...DEFAULT_CONFIG.voicemail_detection,
      ...((data.voicemail_detection as AgentConfig["voicemail_detection"]) ?? {}),
    },
    auto_cut: {
      ...DEFAULT_CONFIG.auto_cut,
      ...((data.auto_cut as AgentConfig["auto_cut"]) ?? {}),
    },
    call_transfer: {
      ...DEFAULT_CONFIG.call_transfer,
      ...((data.call_transfer as AgentConfig["call_transfer"]) ?? {}),
      destinations: Array.isArray((data.call_transfer as AgentConfig["call_transfer"] | undefined)?.destinations)
        ? (data.call_transfer as AgentConfig["call_transfer"]).destinations
        : DEFAULT_CONFIG.call_transfer.destinations,
    },
    memory: {
      ...DEFAULT_CONFIG.memory,
      ...((data.memory as AgentConfig["memory"]) ?? {}),
    },
    dynamic_greeting: {
      ...DEFAULT_CONFIG.dynamic_greeting,
      ...((data.dynamic_greeting as AgentConfig["dynamic_greeting"]) ?? {}),
    },
    variables: Array.isArray(data.variables)
      ? (data.variables as AgentConfig["variables"])
          .filter((v) => v && typeof v.key === "string")
          .map((v) => ({
            key: v.key,
            description: v.description ?? "",
            example: v.example ?? "",
          }))
      : [],
  };
}

export function AgentBuilderPage({ orgId, projectId, agentId, onBack, onSaved }: Props) {
  const [section, setSection] = useState<Section>("identity");
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [ttsVoices, setTtsVoices] = useState<CatalogVoice[]>([]);
  const [orgAnalyses, setOrgAnalyses] = useState<PostCallAnalysis[]>([]);
  const [orgTools, setOrgTools] = useState<CatalogTool[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [flowCanvasKey, setFlowCanvasKey] = useState(0);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [attachedAnalyses, setAttachedAnalyses] = useState<AgentAnalysis[]>([]);
  const [attachedTools, setAttachedTools] = useState<AgentTool[]>([]);
  const [attachSelectId, setAttachSelectId] = useState("");
  const [attachToolId, setAttachToolId] = useState("");
  const [presets, setPresets] = useState<AmbientPreset[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<AudioAsset[]>([]);
  const [uploadingAmbient, setUploadingAmbient] = useState(false);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [versionsTotal, setVersionsTotal] = useState(0);
  const [versionsOffset, setVersionsOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(Boolean(agentId));

  useEffect(() => {
    fetch(`${BACKEND_URL}/v1/providers`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((res: ProvidersResponse) => setProviders(res))
      .catch(() => {});
    api.listAnalyses(orgId, { limit: 100 }).then((page) => setOrgAnalyses(page.items)).catch(() => {});
    api.listTools(orgId, { limit: 100 }).then((page) => setOrgTools(page.items)).catch(() => {});
    api
      .listAudioAssets(orgId, projectId, { limit: 100 })
      .then((page) => {
        setPresets(page.presets);
        setUploadedAssets(page.items);
      })
      .catch(() => {});
  }, [orgId, projectId]);

  useEffect(() => {
    if (!form.tts_id) {
      setTtsVoices([]);
      return;
    }
    let cancelled = false;
    listVoiceTtsVoices(form.tts_id)
      .then((rows) => {
        if (!cancelled) setTtsVoices(rows);
      })
      .catch(() => {
        if (!cancelled) setTtsVoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.tts_id]);

  useEffect(() => {
    if (!agentId) {
      setAgent(null);
      setForm(EMPTY_FORM);
      setFlowCanvasKey((k) => k + 1);
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
          flow_definition: found.flow_definition ?? { ...EMPTY_FLOW },
          config: mergeConfig(found.config),
        });
        setFlowCanvasKey((k) => k + 1);
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

  const availableToAttach = orgAnalyses.filter((a) => !attachedAnalyses.some((x) => x.id === a.id));
  const availableTools = orgTools.filter((t) => !attachedTools.some((x) => x.id === t.id));

  function patchConfig(patch: Partial<AgentConfig>) {
    setForm((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        ...patch,
        llm: { ...prev.config.llm, ...(patch.llm ?? {}) },
        session: { ...prev.config.session, ...(patch.session ?? {}) },
        turn: { ...prev.config.turn, ...(patch.turn ?? {}) },
        audio: {
          ...prev.config.audio,
          ...(patch.audio ?? {}),
          background_noise: {
            ...prev.config.audio.background_noise,
            ...(patch.audio?.background_noise ?? {}),
          },
        },
        end_of_call_warning: {
          ...prev.config.end_of_call_warning,
          ...(patch.end_of_call_warning ?? {}),
        },
        silence_breaker: {
          ...prev.config.silence_breaker,
          ...(patch.silence_breaker ?? {}),
        },
        thinking_sounds: normalizeThinkingSounds({
          ...prev.config.thinking_sounds,
          ...(patch.thinking_sounds ?? {}),
        }),
        voicemail_detection: {
          ...prev.config.voicemail_detection,
          ...(patch.voicemail_detection ?? {}),
        },
        auto_cut: {
          ...prev.config.auto_cut,
          ...(patch.auto_cut ?? {}),
        },
        call_transfer: {
          ...prev.config.call_transfer,
          ...(patch.call_transfer ?? {}),
        },
        variables: patch.variables ?? prev.config.variables,
      },
    }));
  }

  async function refreshAudioAssets() {
    const page = await api.listAudioAssets(orgId, projectId, { limit: 100 });
    setPresets(page.presets);
    setUploadedAssets(page.items);
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
        flow_definition: form.flow_definition,
        config: {
          ...form.config,
          variables: form.config.variables.filter((v) => v.key.trim()),
        },
      };
      const saved = agent
        ? await api.updateAgent(agent.id, body)
        : await api.createAgent(orgId, projectId, body);
      setAgent(saved);
      setForm((prev) => ({
        ...prev,
        config: mergeConfig(saved.config),
        flow_definition: saved.flow_definition ?? prev.flow_definition,
      }));
      onSaved(saved);
      captureEvent("agent_saved", { agent_id: saved.id, org_id: orgId, project_id: projectId });
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
                    placeholder="Hi {first_name}, how can I help you today?"
                  />
                </Field>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Batch variables</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Placeholders like <code className="text-xs">{"{first_name}"}</code> in the
                        prompt, greeting, flow, or voicemail message. Contacts must supply every key.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() =>
                        patchConfig({
                          variables: [
                            ...form.config.variables,
                            { key: "", description: "", example: "" },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Add variable
                    </Button>
                  </div>
                  {form.config.variables.map((variable, index) => (
                    <div key={index} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <Field label="Key">
                        <Input
                          value={variable.key}
                          placeholder="first_name"
                          onChange={(e) => {
                            const next = form.config.variables.map((item, i) =>
                              i === index ? { ...item, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") } : item,
                            );
                            patchConfig({ variables: next });
                          }}
                        />
                      </Field>
                      <Field label="Description">
                        <Input
                          value={variable.description}
                          placeholder="Contact first name"
                          onChange={(e) => {
                            const next = form.config.variables.map((item, i) =>
                              i === index ? { ...item, description: e.target.value } : item,
                            );
                            patchConfig({ variables: next });
                          }}
                        />
                      </Field>
                      <Field label="Example">
                        <Input
                          value={variable.example}
                          placeholder="Sam"
                          onChange={(e) => {
                            const next = form.config.variables.map((item, i) =>
                              i === index ? { ...item, example: e.target.value } : item,
                            );
                            patchConfig({ variables: next });
                          }}
                        />
                      </Field>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() =>
                            patchConfig({
                              variables: form.config.variables.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
                            {formatProviderModel(p.provider_name, p.model_name)}
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
                            {formatProviderModel(p.provider_name, p.model_name)}
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
                            {formatProviderModel(p.provider_name, p.model_name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Voice">
                    <Select
                      value={form.tts_voice_id || "__default__"}
                      onValueChange={(v) => setForm({ ...form, tts_voice_id: v === "__default__" ? "" : v })}
                      disabled={!ttsVoices.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Default voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Default voice</SelectItem>
                        {ttsVoices.map((v) => (
                          <SelectItem key={v.voice_id} value={v.voice_id}>
                            {v.voice_name}
                            {v.user_id ? " (yours)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {section === "flow" && (
              <>
                <SectionTitle
                  title="Conversation flow"
                  description="Optional graph. Empty means a linear agent. Edits save with the agent."
                />
                <FlowCanvas
                  key={flowCanvasKey}
                  orgId={orgId}
                  definition={form.flow_definition}
                  onChange={(flow_definition) => setForm((prev) => ({ ...prev, flow_definition }))}
                />
              </>
            )}

            {section === "features" && (
              <>
                <SectionTitle
                  title="Features"
                  description="Session limits, Smart Turn, barge-in, audio, and tools. Changes version with each save."
                />

                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Session</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Max duration (seconds, 0 = unlimited)">
                      <Input
                        type="number"
                        min={0}
                        step={30}
                        value={form.config.session.max_duration_seconds}
                        onChange={(e) =>
                          patchConfig({ session: { ...form.config.session, max_duration_seconds: Number(e.target.value) } })
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.session.record_calls}
                      onCheckedChange={(v) =>
                        patchConfig({ session: { ...form.config.session, record_calls: v === true } })
                      }
                    />
                    <span>
                      <span className="font-medium">Record calls by default</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Prefer recording when the transport supports it.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">Turn detection</h3>
                  <p className="text-xs text-muted-foreground">
                    A user turn starts when speech-to-text produces real words, not when VAD hears
                    energy — so breaths and noise do not cancel the agent. End of turn is local Smart
                    Turn v3: VAD marks pauses, the model decides whether the user actually finished.
                  </p>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.session.allow_interruptions}
                      onCheckedChange={(v) =>
                        patchConfig({ session: { ...form.config.session, allow_interruptions: v === true } })
                      }
                    />
                    <span>
                      <span className="font-medium">Allow barge-in</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Interrupt the agent after confirmed words (one word while it is thinking, two
                        while it is speaking). Off keeps the agent talking until it finishes.
                      </span>
                    </span>
                  </label>
                  <Field label="VAD hangover (seconds)">
                    <Input
                      type="number"
                      min={0.05}
                      step={0.05}
                      value={form.config.turn.vad_stop_secs}
                      onChange={(e) =>
                        patchConfig({ turn: { vad_stop_secs: Number(e.target.value) } })
                      }
                    />
                    <span className="block text-xs text-muted-foreground">
                      Silence required before VAD reports a pause. Smart Turn uses that pause plus the
                      audio to end the turn. Lower is snappier; higher ignores brief gaps.
                    </span>
                  </Field>
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">Audio</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Noise cancellation">
                      <Select
                        value={form.config.audio.noise_cancellation}
                        onValueChange={(v) =>
                          patchConfig({
                            audio: {
                              ...form.config.audio,
                              noise_cancellation: v as NoiseCancellation,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Off</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Background volume (0–1)">
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={form.config.audio.background_noise.volume}
                        onChange={(e) =>
                          patchConfig({
                            audio: {
                              ...form.config.audio,
                              background_noise: {
                                ...form.config.audio.background_noise,
                                volume: Number(e.target.value),
                              },
                            },
                          })
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.audio.background_noise.enabled}
                      onCheckedChange={(v) =>
                        patchConfig({
                          audio: {
                            ...form.config.audio,
                            background_noise: {
                              ...form.config.audio.background_noise,
                              enabled: v === true,
                            },
                          },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">Background noise loop</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Mix a looping ambient track under the agent voice.
                      </span>
                    </span>
                  </label>
                  {form.config.audio.background_noise.enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Source">
                        <Select
                          value={form.config.audio.background_noise.source}
                          onValueChange={(v) =>
                            patchConfig({
                              audio: {
                                ...form.config.audio,
                                background_noise: {
                                  ...form.config.audio.background_noise,
                                  source: v as "preset" | "asset",
                                  id:
                                    v === "preset"
                                      ? presets[0]?.id || "office"
                                      : uploadedAssets[0]?.id || form.config.audio.background_noise.id,
                                },
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="preset">Preset</SelectItem>
                            <SelectItem value="asset">Uploaded</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Track">
                        <Select
                          value={form.config.audio.background_noise.id}
                          onValueChange={(v) =>
                            patchConfig({
                              audio: {
                                ...form.config.audio,
                                background_noise: {
                                  ...form.config.audio.background_noise,
                                  id: v,
                                },
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select track" />
                          </SelectTrigger>
                          <SelectContent>
                            {form.config.audio.background_noise.source === "preset"
                              ? presets.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))
                              : uploadedAssets.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Upload ambient WAV/MP3" className="sm:col-span-2">
                        <Input
                          type="file"
                          accept="audio/wav,audio/mpeg,.wav,.mp3"
                          disabled={uploadingAmbient}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingAmbient(true);
                            void api
                              .uploadAudioAsset(orgId, projectId, file.name.replace(/\.[^.]+$/, ""), file)
                              .then(async (asset) => {
                                await refreshAudioAssets();
                                patchConfig({
                                  audio: {
                                    ...form.config.audio,
                                    background_noise: {
                                      ...form.config.audio.background_noise,
                                      enabled: true,
                                      source: "asset",
                                      id: asset.id,
                                    },
                                  },
                                });
                              })
                              .catch((err) => setError(err instanceof Error ? err.message : "Upload failed"))
                              .finally(() => {
                                setUploadingAmbient(false);
                                e.target.value = "";
                              });
                          }}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">End-of-call warning</h3>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.end_of_call_warning.enabled}
                      onCheckedChange={(v) =>
                        patchConfig({
                          end_of_call_warning: {
                            ...form.config.end_of_call_warning,
                            enabled: v === true,
                          },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">Warn before hangup</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Speaks a warning before max duration ends the call.
                      </span>
                    </span>
                  </label>
                  {form.config.end_of_call_warning.enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Warn before (seconds)">
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={form.config.end_of_call_warning.warn_before_seconds}
                          onChange={(e) =>
                            patchConfig({
                              end_of_call_warning: {
                                ...form.config.end_of_call_warning,
                                warn_before_seconds: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Mode">
                        <Select
                          value={form.config.end_of_call_warning.mode}
                          onValueChange={(v) =>
                            patchConfig({
                              end_of_call_warning: {
                                ...form.config.end_of_call_warning,
                                mode: v as "simple" | "session_aware",
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple message</SelectItem>
                            <SelectItem value="session_aware">Session-aware template</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      {form.config.end_of_call_warning.mode === "simple" ? (
                        <Field label="Simple message" className="sm:col-span-2">
                          <Textarea
                            rows={2}
                            value={form.config.end_of_call_warning.simple_message}
                            onChange={(e) =>
                              patchConfig({
                                end_of_call_warning: {
                                  ...form.config.end_of_call_warning,
                                  simple_message: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      ) : (
                        <Field
                          label="Template ({remaining_seconds}, {duration_seconds}, {agent_name})"
                          className="sm:col-span-2"
                        >
                          <Textarea
                            rows={3}
                            value={form.config.end_of_call_warning.session_aware_template}
                            onChange={(e) =>
                              patchConfig({
                                end_of_call_warning: {
                                  ...form.config.end_of_call_warning,
                                  session_aware_template: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">Voicemail detection</h3>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.voicemail_detection.enabled}
                      onCheckedChange={(v) =>
                        patchConfig({
                          voicemail_detection: {
                            ...form.config.voicemail_detection,
                            enabled: v === true,
                          },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">Detect voicemail on outbound calls</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        If a machine answers, leave the message below and hang up. On by default for
                        telephony; ignored on web sessions.
                      </span>
                    </span>
                  </label>
                  {form.config.voicemail_detection.enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Message to leave" className="sm:col-span-2">
                        <Textarea
                          rows={2}
                          value={form.config.voicemail_detection.message}
                          onChange={(e) =>
                            patchConfig({
                              voicemail_detection: {
                                ...form.config.voicemail_detection,
                                message: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Response delay (seconds)">
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={form.config.voicemail_detection.response_delay}
                          onChange={(e) =>
                            patchConfig({
                              voicemail_detection: {
                                ...form.config.voicemail_detection,
                                response_delay: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">End call tool</h3>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.auto_cut.enabled}
                      onCheckedChange={(v) =>
                        patchConfig({
                          auto_cut: {
                            ...form.config.auto_cut,
                            enabled: v === true,
                          },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">Allow agent to hang up</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Registers a server-side <code className="text-xs">end_call</code> tool. Off
                        by default.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">Silence breaker</h3>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.config.silence_breaker.enabled}
                      onCheckedChange={(v) =>
                        patchConfig({
                          silence_breaker: {
                            ...form.config.silence_breaker,
                            enabled: v === true,
                          },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">Nudge when user is idle</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Context-aware check-in after idle; never hangs up.
                      </span>
                    </span>
                  </label>
                  {form.config.silence_breaker.enabled && (
                    <Field label="Idle seconds">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={form.config.silence_breaker.idle_seconds}
                        onChange={(e) =>
                          patchConfig({
                            silence_breaker: {
                              ...form.config.silence_breaker,
                              idle_seconds: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  )}
                </div>

                <CallTransferCard
                  config={form.config.call_transfer}
                  onChange={(call_transfer) => patchConfig({ call_transfer })}
                />

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">Tools</h3>
                  <p className="text-xs text-muted-foreground">
                    Attach catalog tools for live function calling. Save the agent first to manage attachments.
                  </p>
                  {!agent && (
                    <p className="text-sm text-muted-foreground">Create the agent to attach tools.</p>
                  )}
                  {agent && (
                    <>
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
                        <div
                          key={tool.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">{tool.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() =>
                              void api.detachAgentTool(agent.id, tool.id).then(() => refreshAttachments(agent.id))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="space-y-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">LLM</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Temperature">
                      <Input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={form.config.llm.temperature}
                        onChange={(e) =>
                          patchConfig({ llm: { ...form.config.llm, temperature: Number(e.target.value) } })
                        }
                      />
                    </Field>
                    <Field label="Max tokens">
                      <Input
                        type="number"
                        min={64}
                        max={8192}
                        step={64}
                        value={form.config.llm.max_tokens}
                        onChange={(e) =>
                          patchConfig({ llm: { ...form.config.llm, max_tokens: Number(e.target.value) } })
                        }
                      />
                    </Field>
                    <Field label="Language" className="sm:col-span-2">
                      <Input
                        value={form.config.llm.language}
                        onChange={(e) => patchConfig({ llm: { ...form.config.llm, language: e.target.value } })}
                        placeholder="en"
                      />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {section === "attachments" && agent && (
              <>
                <SectionTitle
                  title="Attachments"
                  description="Post-call analyses run automatically when a call with this agent ends. Tools live under Features."
                />
                <div className="space-y-3">
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
                    <span className="min-w-0">
                      <span className="font-medium">v{v.version}</span>
                      {v.message ? (
                        <span className="text-muted-foreground"> — {v.message}</span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
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
                            flow_definition: updated.flow_definition ?? { ...EMPTY_FLOW },
                            config: mergeConfig(updated.config),
                          });
                          setFlowCanvasKey((k) => k + 1);
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
