import { BACKEND_URL } from "@/config";
import { api } from "@/lib/api";
import type { CallLanguage, CatalogVoice, ProvidersResponse } from "@/types";
import { CALL_LANGUAGES } from "@/lib/voice/languages";

export interface VoiceLlmProvider {
  id: string;
  provider_name: string;
  model_name: string;
  is_default: boolean;
  supported_languages: string[];
}

export interface VoiceTtsProvider {
  id: string;
  provider_name: string;
  model_name: string;
  is_default: boolean;
  default_voice: string | null;
  supported_languages: string[];
  capabilities?: { speaking_speed?: boolean; pitch?: boolean };
}

export type VoiceTtsVoice = CatalogVoice;

export interface VoiceSttProvider {
  id: string;
  name: string;
  provider_name: string;
  model_name: string;
  is_default: boolean;
  supported_languages: string[];
}

export interface VoiceProvidersCatalog {
  llms: VoiceLlmProvider[];
  tts: VoiceTtsProvider[];
  stt: VoiceSttProvider[];
  languages: CallLanguage[];
  defaults: { llm_id: string; stt_id: string; tts_id: string };
}

async function loadProviders(): Promise<ProvidersResponse> {
  const res = await fetch(`${BACKEND_URL}/v1/providers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function loadVoiceProvidersCatalog(): Promise<VoiceProvidersCatalog> {
  const data = await loadProviders();
  return {
    llms: data.model_providers.map((p) => ({
      id: p.id,
      provider_name: p.provider_name,
      model_name: p.model_name,
      is_default: Boolean(p.is_default),
      supported_languages: p.supported_languages ?? [],
    })),
    tts: data.tts_providers.map((p) => ({
      id: p.id,
      provider_name: p.provider_name,
      model_name: p.model_name,
      is_default: Boolean(p.is_default),
      default_voice: p.default_voice ?? null,
      supported_languages: p.supported_languages ?? [],
      capabilities: p.capabilities,
    })),
    stt: data.transcriber_providers.map((p) => ({
      id: p.id,
      name: `${p.provider_name} / ${p.model_name}`,
      provider_name: p.provider_name,
      model_name: p.model_name,
      is_default: Boolean(p.is_default),
      supported_languages: p.supported_languages ?? [],
    })),
    languages: data.languages?.length ? data.languages : CALL_LANGUAGES,
    defaults: data.defaults ?? data.selected ?? { llm_id: "", stt_id: "", tts_id: "" },
  };
}

export async function listVoiceLlmProviders(): Promise<VoiceLlmProvider[]> {
  return (await loadVoiceProvidersCatalog()).llms;
}

export async function listVoiceTtsProviders(): Promise<VoiceTtsProvider[]> {
  return (await loadVoiceProvidersCatalog()).tts;
}

/** Voices for one TTS catalog UUID, or a public provider name (`kupe`, `elevenlabs`). */
export async function listVoiceTtsVoices(provider?: string): Promise<VoiceTtsVoice[]> {
  if (!provider) return listAllTtsVoices();
  const { items } = await api.listVoices(provider);
  if (items.some((v) => v.provider_name)) return items;
  const { tts } = await loadVoiceProvidersCatalog();
  const needle = provider.trim().toLowerCase();
  const p = tts.find(
    (x) => x.id === provider || x.provider_name.toLowerCase() === needle,
  );
  if (!p) return items;
  return items.map((v) => ({
    ...v,
    provider_name: p.provider_name,
    model_name: p.model_name,
  }));
}

/** Every enabled TTS catalog, each voice tagged with provider + model. */
export async function listAllTtsVoices(): Promise<CatalogVoice[]> {
  const { items } = await api.listVoices();
  return items;
}

export async function listVoiceSttProviders(): Promise<VoiceSttProvider[]> {
  return (await loadVoiceProvidersCatalog()).stt;
}

/** The Kupe-branded TTS provider (Soniox under the hood — masked server-side,
 * see kupe-backend's catalog_fields.py) — the only provider the Voice
 * Library / cloning UI needs, since cloning is only offered on this one. */
export async function getKupeVoiceProvider(): Promise<VoiceTtsProvider | null> {
  const { tts } = await loadVoiceProvidersCatalog();
  return tts.find((p) => p.provider_name.toLowerCase() === "kupe") ?? tts.find((p) => p.is_default) ?? tts[0] ?? null;
}

export async function cloneVoice(data: { name: string; isPublic: boolean; sample: File }): Promise<CatalogVoice> {
  return api.cloneVoice(data);
}

export async function updateVoice(voiceId: string, data: { name?: string; isPublic?: boolean }): Promise<CatalogVoice> {
  return api.updateVoice(voiceId, data);
}

export async function deleteVoice(voiceId: string): Promise<void> {
  return api.deleteVoice(voiceId);
}

export async function speakVoicePreview(
  voiceId: string,
  text: string,
  language = "en",
  extras?: { orgId: string; speed?: number; pitch?: number },
): Promise<Blob> {
  if (!extras?.orgId) throw new Error("Select a workspace first.");
  return api.speakVoice(voiceId, { text, language, orgId: extras.orgId, speed: extras.speed, pitch: extras.pitch });
}

const previewObjectUrls = new Map<string, string>();

/** Shared catalog sample — server caches once; browser reuses the object URL. */
export async function fetchVoicePreview(voiceId: string): Promise<string> {
  const hit = previewObjectUrls.get(voiceId);
  if (hit) return hit;
  const blob = await api.getVoicePreview(voiceId);
  const url = URL.createObjectURL(blob);
  previewObjectUrls.set(voiceId, url);
  return url;
}
