"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GripVertical, Loader2, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableMultiSelect, SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { KupeVoicePicker } from "@/components/voice-agents/kupe-voice-picker";
import { ProviderLogo } from "@/components/voice-agents/provider-logo";
import { cn } from "@/lib/utils";
import {
  getAgentSettings,
  updateAgentSettings,
  type AgentSettings,
} from "@/lib/api/voice/agent-builder";
import {
  listVoiceTtsVoices,
  loadVoiceProvidersCatalog,
  type VoiceLlmProvider,
  type VoiceSttProvider,
  type VoiceTtsProvider,
  type VoiceTtsVoice,
} from "@/lib/api/voice/providers";
import { updateVoiceAgent } from "@/lib/api/voice/agents";
import type { VoiceAgent } from "@/lib/api/voice/types";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { CALL_LANGUAGES, languageLabel, type CallLanguage } from "@/lib/voice/languages";
import { displayProviderName, formatProviderModel } from "@/lib/voice/provider-brand";

function SettingRow({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 py-3", className)}>
      <div className="min-w-0 max-w-md">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function RangeControl({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  className?: string;
}) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="kupe-range"
        style={{ "--range-progress": `${progress}%` } as CSSProperties}
      />
      <span className="min-w-[3.5rem] text-right text-sm tabular-nums text-muted-foreground">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function providerOptions(
  rows: { id: string; provider_name: string; model_name: string; is_default?: boolean }[],
): SearchableOption[] {
  return rows.map((p) => {
    const label = formatProviderModel(p.provider_name, p.model_name);
    return {
      value: p.id,
      label,
      icon: <ProviderLogo provider={p.provider_name} size="sm" />,
      keywords: `${p.provider_name} ${displayProviderName(p.provider_name)} ${p.model_name} ${label}`,
      hint: p.is_default ? "default" : undefined,
    };
  });
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-t border-border pt-5 text-sm font-semibold tracking-tight first:border-t-0 first:pt-0">
      {children}
    </h3>
  );
}

const DEFAULTS: Required<
  Omit<AgentSettings, "temperature_override" | "switch_after_seconds" | "voicemail_message">
> & {
  temperature_override: number | null;
  switch_after_seconds: number | null;
  voicemail_message: string;
} = {
  speaking_speed: 1.0,
  pitch: 0,
  temperature_override: null,
  knowledge_base_ids: [],
  allow_interruptions: true,
  eagerness: 5,
  volume_threshold_db: -30,
  background_sound: "none",
  background_volume: 0,
  multilingual_enabled: false,
  allowed_languages: ["en"],
  auto_detect_language: false,
  switch_after_seconds: null,
  starting_language: "en",
  output_numbers_indic: false,
  nudges: [],
  hangup_after_unanswered_nudges: false,
  voicemail_enabled: false,
  voicemail_message: "",
  max_call_length_minutes: 10,
};

const AUTO_SAVE_MS = 1000;

const INDIC_LANGS = new Set([
  "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "od", "ml", "pa",
  "as", "mai", "sat", "ks", "ne", "kok", "sd", "doi", "mni", "brx", "sa",
]);

function langBase(code: string): string {
  return code.trim().toLowerCase().replace("_", "-").split("-")[0] ?? "";
}

function languageOverlap(a: string[] = [], b: string[] = []): string[] {
  const right = new Set(b.map(langBase).filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of a) {
    const base = langBase(code);
    if (base && right.has(base) && !seen.has(base)) {
      seen.add(base);
      out.push(base);
    }
  }
  return out;
}

function pickDefaultId<T extends { id: string; is_default?: boolean }>(rows: T[], current?: string | null): string {
  if (current && rows.some((r) => r.id === current)) return current;
  const marked = rows.find((r) => r.is_default);
  return marked?.id ?? rows[0]?.id ?? "";
}

export function AgentSettingsPanel({
  agentId,
  agent,
  onAgentUpdated,
}: {
  agentId: string;
  agent?: VoiceAgent | null;
  onAgentUpdated?: () => void;
}) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [llmProviders, setLlmProviders] = useState<VoiceLlmProvider[]>([]);
  const [ttsProviders, setTtsProviders] = useState<VoiceTtsProvider[]>([]);
  const [sttProviders, setSttProviders] = useState<VoiceSttProvider[]>([]);
  const [voices, setVoices] = useState<VoiceTtsVoice[]>([]);
  const [languages, setLanguages] = useState<CallLanguage[]>(CALL_LANGUAGES);
  const [llmId, setLlmId] = useState(agent?.llm_provider_id ?? "");
  const [ttsId, setTtsId] = useState(agent?.tts_provider_id ?? "");
  const [voiceId, setVoiceId] = useState(agent?.tts_voice_id ?? "");
  const [sttId, setSttId] = useState(agent?.stt_provider_id ?? "");
  const defaultsApplied = useRef(false);
  const autoSaveArmed = useRef(false);
  const lastSavedRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | null>(null);

  useEffect(() => {
    setLlmId(agent?.llm_provider_id ?? "");
    setTtsId(agent?.tts_provider_id ?? "");
    setVoiceId(agent?.tts_voice_id ?? "");
    setSttId(agent?.stt_provider_id ?? "");
    defaultsApplied.current = false;
  }, [agent?.llm_provider_id, agent?.tts_provider_id, agent?.tts_voice_id, agent?.stt_provider_id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProvidersError(null);
    Promise.all([getAgentSettings(agentId), loadVoiceProvidersCatalog()])
      .then(([s, catalog]) => {
        if (cancelled) return;
        setSettings({
          ...DEFAULTS,
          ...s,
          voicemail_message: s.voicemail_message ?? "",
          allowed_languages: s.allowed_languages?.length ? s.allowed_languages : ["en"],
          starting_language: s.starting_language || "en",
        });
        setLlmProviders(catalog.llms);
        setTtsProviders(catalog.tts);
        setSttProviders(catalog.stt);
        setLanguages(catalog.languages.length ? catalog.languages : CALL_LANGUAGES);

        const nextLlm = pickDefaultId(catalog.llms, agent?.llm_provider_id);
        const nextTts = pickDefaultId(catalog.tts, agent?.tts_provider_id);
        const nextStt = pickDefaultId(catalog.stt, agent?.stt_provider_id);
        setLlmId(nextLlm);
        setTtsId(nextTts);
        setSttId(nextStt);

        if (!catalog.llms.length && !catalog.tts.length && !catalog.stt.length) {
          setProvidersError(
            "No voice providers are set up yet. Ask an admin to seed LLM / TTS / STT catalogs.",
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(friendlyVoiceError(err, "Couldn't load settings"));
        setProvidersError(friendlyVoiceError(err, "Couldn't load providers"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [agentId, agent?.llm_provider_id, agent?.tts_provider_id, agent?.stt_provider_id]);

  useEffect(() => {
    if (!ttsId) {
      setVoices([]);
      return;
    }
    let cancelled = false;
    listVoiceTtsVoices(ttsId)
      .then((rows) => {
        if (cancelled) return;
        setVoices(rows);
        setVoiceId((prev) => {
          const matchPrev = rows.find((r) => r.voice_id === prev || r.id === prev);
          if (matchPrev) return matchPrev.voice_id;
          const matchDefault = rows.find(
            (r) =>
              r.voice_id ===
              ttsProviders.find((p) => p.id === ttsId)?.default_voice,
          );
          return matchDefault?.voice_id ?? rows[0]?.voice_id ?? "";
        });
      })
      .catch(() => !cancelled && setVoices([]));
    return () => {
      cancelled = true;
    };
  }, [ttsId, ttsProviders]);

  // Persist catalog defaults onto the agent once so Test Agent / calls work.
  useEffect(() => {
    if (loading || defaultsApplied.current || !agent) return;
    const needs =
      (!agent.llm_provider_id && llmId) ||
      (!agent.tts_provider_id && ttsId) ||
      (!agent.stt_provider_id && sttId) ||
      (!agent.tts_voice_id && voiceId);
    if (!needs) {
      defaultsApplied.current = true;
      return;
    }
    defaultsApplied.current = true;
    void updateVoiceAgent(agentId, {
      llm_provider_id: llmId || null,
      tts_provider_id: ttsId || null,
      tts_voice_id: voiceId || null,
      stt_provider_id: sttId || null,
    } as Partial<VoiceAgent>)
      .then(() => onAgentUpdated?.())
      .catch(() => {
        /* keep UI selections; user can Save */
      });
  }, [
    loading,
    agent,
    agentId,
    llmId,
    ttsId,
    sttId,
    voiceId,
    onAgentUpdated,
  ]);

  function snapshotOf(
    nextSettings = settings,
    nextLlm = llmId,
    nextTts = ttsId,
    nextVoice = voiceId,
    nextStt = sttId,
  ) {
    return JSON.stringify({
      settings: nextSettings,
      llmId: nextLlm,
      ttsId: nextTts,
      voiceId: nextVoice,
      sttId: nextStt,
    });
  }

  async function save(isAutoSave = false) {
    setSaving(true);
    if (isAutoSave) setSaveStatus("saving");
    const snapshotAtSave = snapshotOf();
    try {
      await updateAgentSettings(agentId, settings);
      await updateVoiceAgent(agentId, {
        llm_provider_id: llmId || null,
        tts_provider_id: ttsId || null,
        tts_voice_id: voiceId || null,
        stt_provider_id: sttId || null,
      } as Partial<VoiceAgent>);
      lastSavedRef.current = snapshotAtSave;
      setSaveStatus("saved");
      if (!isAutoSave) {
        toast.success("Settings saved");
        onAgentUpdated?.();
      }
    } catch (err) {
      setSaveStatus("unsaved");
      toast.error(friendlyVoiceError(err, isAutoSave ? "Auto-save failed" : "Couldn't save settings"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (loading) {
      autoSaveArmed.current = false;
      return;
    }
    lastSavedRef.current = snapshotOf();
    const arm = window.setTimeout(() => {
      lastSavedRef.current = snapshotOf();
      autoSaveArmed.current = true;
      setSaveStatus("saved");
    }, 400);
    return () => window.clearTimeout(arm);
    // Snapshot at arm time; don't re-arm on every field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, agentId]);

  useEffect(() => {
    if (!autoSaveArmed.current || loading || saving) return;
    const current = snapshotOf();
    if (current === lastSavedRef.current) {
      setSaveStatus((prev) => (prev === "saving" ? prev : "saved"));
      return;
    }
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void save(true);
    }, AUTO_SAVE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, llmId, ttsId, voiceId, sttId, loading, saving]);

  function set<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const nudges = settings.nudges ?? [];
  const selectedTts = ttsProviders.find((p) => p.id === ttsId);
  const selectedStt = sttProviders.find((p) => p.id === sttId);
  const selectedLlm = llmProviders.find((p) => p.id === llmId);
  const ttsCaps = selectedTts?.capabilities;
  const ttsName = (selectedTts?.provider_name || "").toLowerCase();
  const showSpeed =
    ttsCaps?.speaking_speed ??
    ["openai", "deepgram", "eleven_labs", "sarvam", "smallest_ai", "soniox", "kupe"].includes(ttsName);
  const showPitch =
    ttsCaps?.pitch ??
    (ttsName === "deepgram" || (ttsName === "sarvam" && !(selectedTts?.model_name || "").toLowerCase().startsWith("bulbul:v3")));
  const overlap = languageOverlap(selectedStt?.supported_languages, selectedTts?.supported_languages);
  const showLanguageSwitch = overlap.length > 1;
  const showIndic =
    (selectedTts?.supported_languages ?? []).some((c) => INDIC_LANGS.has(langBase(c))) ||
    (selectedLlm?.supported_languages ?? []).some((c) => INDIC_LANGS.has(langBase(c)));

  if (loading) {
    return (
      <div className="w-full space-y-4 px-6 py-6 md:px-10 lg:px-12">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-1 px-6 py-6 pb-16 md:px-10 lg:px-12">
      <div className="sticky top-0 z-10 -mx-6 mb-2 flex h-12 items-center justify-end border-b border-border bg-background/95 px-6 backdrop-blur md:-mx-10 md:px-10 lg:-mx-12 lg:px-12">
        {saveStatus === "saving" || saving ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Saving
          </span>
        ) : saveStatus === "unsaved" ? (
          <span className="text-xs text-muted-foreground">Unsaved</span>
        ) : saveStatus === "saved" ? (
          <span className="text-xs text-muted-foreground">Saved</span>
        ) : null}
      </div>

      <SectionTitle>Providers</SectionTitle>
      {providersError ? (
        <p className="mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {providersError}
        </p>
      ) : null}
      <SettingRow title="LLM" description="Model used for replies on calls. Default is Kupe / Gemma 4 31B IT.">
        <SearchableSelect
          value={llmId}
          onChange={setLlmId}
          disabled={!llmProviders.length}
          placeholder={llmProviders.length ? "Select LLM" : "No LLMs available"}
          searchPlaceholder="Search models…"
          options={providerOptions(llmProviders)}
        />
      </SettingRow>
      <SettingRow title="Voice (TTS)" description="How the agent speaks. Default is Kupe / k-TTS.">
        <SearchableSelect
          value={ttsId}
          onChange={(v) => {
            setTtsId(v);
            setVoiceId("");
          }}
          disabled={!ttsProviders.length}
          placeholder={ttsProviders.length ? "Select TTS" : "No TTS available"}
          searchPlaceholder="Search TTS models…"
          options={providerOptions(ttsProviders)}
        />
      </SettingRow>
      <SettingRow title="Voice identity" description="Specific TTS voice for this model — search, preview, and pick.">
        <KupeVoicePicker
          voices={voices}
          value={voiceId}
          onValueChange={setVoiceId}
          disabled={!ttsId || !voices.length}
          placeholder={voices.length ? "Select voice" : "No voices for this TTS"}
        />
      </SettingRow>
      <SettingRow title="Speech recognition (STT)" description="How caller audio is transcribed. Default is Kupe / k-STT.">
        <SearchableSelect
          value={sttId}
          onChange={setSttId}
          disabled={!sttProviders.length}
          placeholder={sttProviders.length ? "Select STT" : "No STT available"}
          searchPlaceholder="Search STT models…"
          options={providerOptions(sttProviders)}
        />
      </SettingRow>

      <SectionTitle>Speaking</SectionTitle>
      {showSpeed && (
        <SettingRow title="Speaking speed" description="How fast the agent talks.">
          <RangeControl
            value={settings.speaking_speed}
            min={0.7}
            max={1.4}
            step={0.05}
            onChange={(v) => set("speaking_speed", v)}
            format={(v) => `${v.toFixed(2)} x`}
          />
        </SettingRow>
      )}
      {showPitch && (
        <SettingRow title="Pitch" description="Voice pitch offset.">
          <RangeControl
            value={settings.pitch}
            min={-5}
            max={5}
            step={0.25}
            onChange={(v) => set("pitch", v)}
            format={(v) => v.toFixed(2)}
          />
        </SettingRow>
      )}

      <SectionTitle>Thinking & knowledge</SectionTitle>
      <SettingRow
        title="Model temperature"
        description="Lower stays compliant; higher is more creative."
      >
        <div className="flex flex-col items-end gap-1">
          <RangeControl
            value={settings.temperature_override ?? 0.5}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => set("temperature_override", v)}
            format={() => ""}
            className="w-48"
          />
          <div className="flex w-48 justify-between text-[10px] text-muted-foreground">
            <span>Compliant</span>
            <span>Creative</span>
          </div>
        </div>
      </SettingRow>

      <SectionTitle>Listening</SectionTitle>
      <SettingRow title="Let callers interrupt" description="Caller can talk over the agent.">
        <Switch checked={settings.allow_interruptions} onCheckedChange={(v) => set("allow_interruptions", v)} />
      </SettingRow>
      <SettingRow title="Eagerness to respond" description="How quickly the agent replies after a pause.">
        <RangeControl value={settings.eagerness} min={1} max={10} onChange={(v) => set("eagerness", v)} />
      </SettingRow>
      <SettingRow title="Volume threshold" description="Quieter audio below this counts as silence.">
        <RangeControl
          value={settings.volume_threshold_db}
          min={-60}
          max={-10}
          step={1}
          onChange={(v) => set("volume_threshold_db", v)}
          format={(v) => `${v} dB`}
        />
      </SettingRow>

      <SectionTitle>Environment</SectionTitle>
      <SettingRow title="Background sound" description="Ambient noise behind the agent.">
        <Select value={settings.background_sound} onValueChange={(v) => set("background_sound", v)}>
          <SelectTrigger className="h-9 w-44 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quiet-office">Quiet office</SelectItem>
            <SelectItem value="cafe">Cafe</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          aria-label="Preview sound"
          onClick={() => toast.message("Playing ambient preview…")}
        >
          <Play className="size-3.5" />
        </Button>
      </SettingRow>
      <SettingRow title="Background volume" description="How loud the ambient noise plays.">
        <RangeControl
          value={settings.background_volume}
          min={0}
          max={100}
          onChange={(v) => set("background_volume", v)}
          format={(v) => `${v}%`}
        />
      </SettingRow>

      <SectionTitle>Language personalisation</SectionTitle>
      {showLanguageSwitch && (
        <>
          <SettingRow title="Switch language during call" description="Follow when the caller switches languages.">
            <Switch checked={settings.multilingual_enabled} onCheckedChange={(v) => set("multilingual_enabled", v)} />
          </SettingRow>
          <SettingRow title="Auto-detected language switch" description="Match the caller's language automatically.">
            <Switch checked={settings.auto_detect_language} onCheckedChange={(v) => set("auto_detect_language", v)} />
          </SettingRow>
          <SettingRow title="Switch after" description="Seconds before switching. Empty uses default.">
            <Input
              type="number"
              className="h-9 w-28 rounded-full text-center"
              value={settings.switch_after_seconds ?? ""}
              onChange={(e) => set("switch_after_seconds", e.target.value ? Number(e.target.value) : null)}
            />
          </SettingRow>
          <SettingRow
            title="Allowed languages"
            description="Callers can use any of these. Search English through all India languages."
          >
            <SearchableMultiSelect
              values={settings.allowed_languages}
              onChange={(next) => {
                const langs = next.length ? next : [settings.starting_language || "en"];
                set("allowed_languages", langs);
                if (!langs.includes(settings.starting_language)) {
                  set("starting_language", langs[0]);
                }
              }}
              placeholder="Select languages"
              searchPlaceholder="Search languages…"
              options={languages.map((l) => ({
                value: l.code,
                label: languageLabel(l.code, languages),
                keywords: `${l.name} ${l.native_name} ${l.code}`,
              }))}
            />
          </SettingRow>
        </>
      )}
      <SettingRow title="Starting language" description="Language the agent opens with. English plus all India scheduled languages.">
        <SearchableSelect
          value={settings.starting_language}
          onChange={(v) => {
            set("starting_language", v);
            if (!settings.allowed_languages.includes(v)) {
              set("allowed_languages", [...settings.allowed_languages, v]);
            }
          }}
          placeholder="Select language"
          searchPlaceholder="Search languages…"
          options={languages.map((l) => ({
            value: l.code,
            label: languageLabel(l.code, languages),
            keywords: `${l.name} ${l.native_name} ${l.code}`,
          }))}
        />
      </SettingRow>
      {showIndic && (
        <SettingRow title="Output numbers in Indic" description="E.g. '500' → 'paanch sau'.">
          <Switch checked={settings.output_numbers_indic} onCheckedChange={(v) => set("output_numbers_indic", v)} />
        </SettingRow>
      )}

      <SectionTitle>In call actions</SectionTitle>
      <SettingRow title="Nudge quiet callers" description="Speak up if the caller goes silent" className="items-center">
        <Switch
          checked={nudges.length > 0}
          onCheckedChange={(v) => set("nudges", v ? [{ text: "Are you still there?", after_seconds: 10 }] : [])}
        />
      </SettingRow>
      {nudges.length > 0 && (
        <div className="mb-2 rounded-xl border border-border bg-muted/30 p-3">
          <ul className="space-y-3">
            {nudges.map((n, i) => (
              <li key={i} className="flex flex-wrap items-end gap-2">
                <GripVertical className="mb-2 size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Message {i + 1}</label>
                  <Input
                    value={n.text}
                    onChange={(e) =>
                      set(
                        "nudges",
                        nudges.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)),
                      )
                    }
                    className="rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1.5 pb-0.5 text-sm text-muted-foreground">
                  <span>after</span>
                  <Input
                    type="number"
                    value={n.after_seconds}
                    onChange={(e) =>
                      set(
                        "nudges",
                        nudges.map((x, idx) =>
                          idx === i ? { ...x, after_seconds: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                    className="h-9 w-16 rounded-lg text-center"
                  />
                  <span>seconds</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove nudge"
                  onClick={() => set("nudges", nudges.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => set("nudges", [...nudges, { text: "Are you still there?", after_seconds: 10 }])}
            >
              + Add More
            </Button>
          </div>
        </div>
      )}

      <SettingRow title="Hang up after unanswered nudges" description="End the call if still no response">
        <Switch
          checked={settings.hangup_after_unanswered_nudges}
          onCheckedChange={(v) => set("hangup_after_unanswered_nudges", v)}
        />
      </SettingRow>
      <SettingRow title="Voicemail" description="Leave a message when voicemail is detected">
        <Switch checked={settings.voicemail_enabled} onCheckedChange={(v) => set("voicemail_enabled", v)} />
      </SettingRow>
      <SettingRow title="Voicemail message" description="What the agent says on voicemail" className="items-start">
        <textarea
          value={settings.voicemail_message ?? ""}
          onChange={(e) => set("voicemail_message", e.target.value)}
          rows={4}
          className="min-h-[96px] w-full max-w-md resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </SettingRow>
      <SettingRow title="Max call length" description="Ends the call after this many minutes">
        <Input
          type="number"
          min={1}
          max={120}
          value={settings.max_call_length_minutes}
          onChange={(e) => set("max_call_length_minutes", Number(e.target.value) || 1)}
          className="h-9 w-20 rounded-full text-center"
        />
      </SettingRow>
    </div>
  );
}
