import { BACKEND_URL } from "@/config";
import type { ProvidersResponse } from "@/types";

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

export interface VoiceTtsVoice {
  id: string;
  provider_id: string;
  voice_name: string;
  voice_id: string;
  supported_languages: string[];
}

export interface VoiceSttProvider {
  id: string;
  name: string;
  provider_name: string;
  model_name: string;
  is_default: boolean;
  supported_languages: string[];
}

async function loadProviders(): Promise<ProvidersResponse> {
  const res = await fetch(`${BACKEND_URL}/v1/providers`);
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function listVoiceLlmProviders(): Promise<VoiceLlmProvider[]> {
  const data = await loadProviders();
  return data.model_providers.map((p) => ({
    id: p.id,
    provider_name: p.provider_name,
    model_name: p.model_name,
    is_default: Boolean(p.is_default),
    supported_languages: [],
  }));
}

export async function listVoiceTtsProviders(): Promise<VoiceTtsProvider[]> {
  const data = await loadProviders();
  return data.tts_providers.map((p) => ({
    id: p.id,
    provider_name: p.provider_name,
    model_name: p.model_name,
    is_default: Boolean(p.is_default),
    default_voice: p.default_voice ?? null,
    supported_languages: [],
  }));
}

export async function listVoiceTtsVoices(providerId?: string): Promise<VoiceTtsVoice[]> {
  const data = await loadProviders();
  const providers = providerId
    ? data.tts_providers.filter((p) => p.id === providerId)
    : data.tts_providers;
  return providers.flatMap((p) =>
    (p.voices ?? []).map((v) => ({
      id: v.id,
      provider_id: p.id,
      voice_name: v.voice_name,
      voice_id: v.voice_id,
      supported_languages: v.supported_languages ?? [],
    })),
  );
}

export async function listVoiceSttProviders(): Promise<VoiceSttProvider[]> {
  const data = await loadProviders();
  return data.transcriber_providers.map((p) => ({
    id: p.id,
    name: `${p.provider_name} / ${p.model_name}`,
    provider_name: p.provider_name,
    model_name: p.model_name,
    is_default: Boolean(p.is_default),
    supported_languages: [],
  }));
}
