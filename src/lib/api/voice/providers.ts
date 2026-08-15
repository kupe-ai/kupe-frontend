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
  const res = await fetch(`${BACKEND_URL}/v1/providers`);
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

export async function listVoiceTtsVoices(providerId?: string): Promise<VoiceTtsVoice[]> {
  if (!providerId) return [];
  const { items } = await api.listVoices(providerId);
  return items;
}

export async function listVoiceSttProviders(): Promise<VoiceSttProvider[]> {
  return (await loadVoiceProvidersCatalog()).stt;
}
