"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KupeVoicePicker } from "@/components/voice-agents/kupe-voice-picker";
import { ProviderLogo } from "@/components/voice-agents/provider-logo";
import { requireScope } from "@/lib/api/workspace-scope";
import { speakVoicePreview, type VoiceTtsProvider } from "@/lib/api/voice/providers";
import { cn } from "@/lib/utils";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { displayProviderName, formatProviderModel } from "@/lib/voice/provider-brand";
import { resolveSpeakingControls } from "@/lib/voice/speaking-controls";
import type { CatalogVoice } from "@/types";

type RecentClip = {
  id: string;
  text: string;
  voiceName: string;
  providerLine: string;
  audioUrl: string;
  createdAt: number;
};

function RangeControl({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
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

function providerOptions(rows: VoiceTtsProvider[]): SearchableOption[] {
  return rows.map((p) => {
    const label = formatProviderModel(p.provider_name, p.model_name);
    return {
      value: p.id,
      label,
      icon: <ProviderLogo provider={p.provider_name} model={p.model_name} size="sm" />,
      keywords: `${p.provider_name} ${displayProviderName(p.provider_name, p.model_name)} ${p.model_name} ${label}`,
      hint: p.is_default ? "default" : undefined,
    };
  });
}

export function TtsStudio({
  providers,
  voices,
}: {
  providers: VoiceTtsProvider[];
  voices: CatalogVoice[];
}) {
  const [ttsId, setTtsId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState(
    "Hi, thanks for calling — main aapki kaise help kar sakti hoon? We can set up a demo today.",
  );
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [speakingValues, setSpeakingValues] = useState<Record<string, number | boolean | string>>({});
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentClip[]>([]);

  useEffect(() => {
    if (!ttsId && providers.length) {
      const kupe = providers.find((p) => p.provider_name.toLowerCase() === "kupe");
      setTtsId(kupe?.id ?? providers[0]!.id);
    }
  }, [providers, ttsId]);

  const provider = providers.find((p) => p.id === ttsId);
  const providerVoices = useMemo(
    () => voices.filter((v) => v.provider_id === ttsId),
    [voices, ttsId],
  );

  useEffect(() => {
    if (!providerVoices.some((v) => v.voice_id === voiceId)) {
      setVoiceId(providerVoices[0]?.voice_id ?? "");
    }
  }, [providerVoices, voiceId]);

  const speakingControls = resolveSpeakingControls(
    provider?.provider_name,
    provider?.model_name,
    provider?.capabilities?.speaking,
  );
  const showSpeed = speakingControls.some((c) => c.key === "speaking_speed");
  const showPitch = speakingControls.some((c) => c.key === "pitch");
  const selectedVoice = providerVoices.find((v) => v.voice_id === voiceId);

  function speakingNumber(key: string, fallback: number) {
    const value = speakingValues[key];
    return typeof value === "number" ? value : fallback;
  }

  async function generate() {
    if (!selectedVoice || !text.trim()) return;
    let orgId: string;
    try {
      orgId = requireScope().orgId;
    } catch {
      toast.error("Select a workspace first");
      return;
    }
    setGenerating(true);
    try {
      const blob = await speakVoicePreview(selectedVoice.id, text.trim(), "en", {
        orgId,
        speed: showSpeed ? speakingNumber("speaking_speed", speed) : undefined,
        pitch: showPitch ? speakingNumber("pitch", pitch) : undefined,
      });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setRecents((prev) => [
        {
          id: `${Date.now()}`,
          text: text.trim(),
          voiceName: selectedVoice.voice_name,
          providerLine: formatProviderModel(selectedVoice.provider_name ?? "", selectedVoice.model_name ?? ""),
          audioUrl: url,
          createdAt: Date.now(),
        },
        ...prev,
      ].slice(0, 20));
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't generate speech"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">Transcript</p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="Write something to say…"
            className="mt-3 min-h-36"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{text.length}/2000</p>
            <Button type="button" className="rounded-full" onClick={() => void generate()} loading={generating}>
              Generate
            </Button>
          </div>
          {audioUrl ? (
            <AudioPlayer src={audioUrl} className="mt-4" downloadName={`${selectedVoice?.voice_name ?? "voice"}.mp3`} />
          ) : null}
        </div>

        <section>
          <p className="mb-2 text-sm font-semibold">Recents</p>
          {recents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
              Generations from this session show up here. They aren't stored on the server.
            </div>
          ) : (
            <ul className="space-y-2">
              {recents.map((clip) => (
                <li key={clip.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="line-clamp-2 text-sm">{clip.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {clip.voiceName} · {clip.providerLine} ·{" "}
                    {new Date(clip.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Voice (TTS)</p>
          <SearchableSelect
            value={ttsId}
            onChange={(id) => {
              setTtsId(id);
              setVoiceId("");
            }}
            disabled={!providers.length}
            placeholder={providers.length ? "Select TTS" : "No TTS available"}
            searchPlaceholder="Search TTS models…"
            options={providerOptions(providers)}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Voice identity</p>
          <KupeVoicePicker
            voices={providerVoices}
            value={voiceId}
            onValueChange={setVoiceId}
            disabled={!ttsId || !providerVoices.length}
            placeholder={providerVoices.length ? "Select voice" : "No voices for this TTS"}
            className="w-full"
          />
        </div>
        {speakingControls.length ? (
          speakingControls.map((control) => {
            if (control.kind === "toggle") {
              const value = Boolean(speakingValues[control.key] ?? control.default ?? false);
              return (
                <div key={control.key} className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted-foreground">{control.label}</p>
                  <Switch
                    checked={value}
                    onCheckedChange={(v) => setSpeakingValues((prev) => ({ ...prev, [control.key]: v }))}
                  />
                </div>
              );
            }
            if (control.kind === "select") {
              const value = String(speakingValues[control.key] ?? control.default ?? "");
              return (
                <div key={control.key} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{control.label}</p>
                  <Select
                    value={value}
                    onValueChange={(v) => setSpeakingValues((prev) => ({ ...prev, [control.key]: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(control.options ?? []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            const min = control.min ?? 0;
            const max = control.max ?? 1;
            const value = speakingNumber(control.key, Number(control.default ?? (control.key === "pitch" ? pitch : speed)));
            return (
              <div key={control.key} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{control.label}</p>
                <RangeControl
                  value={value}
                  min={min}
                  max={max}
                  step={control.step ?? 0.05}
                  onChange={(v) => {
                    setSpeakingValues((prev) => ({ ...prev, [control.key]: v }));
                    if (control.key === "speaking_speed") setSpeed(v);
                    if (control.key === "pitch") setPitch(v);
                  }}
                  format={(v) =>
                    control.format === "multiplier" ? `${v.toFixed(2)} x` : v.toFixed(v % 1 === 0 ? 0 : 2)
                  }
                />
              </div>
            );
          })
        ) : (
          <>
            {showSpeed ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Speaking speed</p>
                <RangeControl
                  value={speed}
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  onChange={setSpeed}
                  format={(v) => `${v.toFixed(2)} x`}
                />
              </div>
            ) : null}
            {showPitch ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Pitch</p>
                <RangeControl
                  value={pitch}
                  min={-5}
                  max={5}
                  step={0.5}
                  onChange={setPitch}
                  format={(v) => v.toFixed(1)}
                />
              </div>
            ) : null}
          </>
        )}
        <p className={cn("text-xs text-muted-foreground", !showSpeed && !showPitch && "pt-1")}>
          This generation is billed to the workspace wallet. Catalog voice samples stay cached and free to replay.
        </p>
      </aside>
    </div>
  );
}
