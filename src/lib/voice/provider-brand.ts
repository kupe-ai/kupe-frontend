/** Display names + logo files for LLM / TTS / STT catalog providers. */

// Sarvam's LLM catalog entries (sarvam-105b, glm-5.2, gemma-4-31b) are
// white-labeled as "Kai" with Kupe's mark -- Sarvam's STT/TTS models
// (saarika, bulbul) are unaffected and keep the Sarvam brand below. Model
// names are matched case-insensitively against provider_catalog.model_name.
const SARVAM_LLM_MODELS = new Set(["sarvam-105b", "glm-5.2", "gemma-4-31b"]);
const KAI_BRAND = { label: "Kai", logo: "/brand/kupe-mark.png" };

function isSarvamLlmModel(provider: string, model?: string): boolean {
  return providerKey(provider) === "sarvam" && !!model && SARVAM_LLM_MODELS.has(model.trim().toLowerCase());
}

const BRANDS: Record<string, { label: string; logo: string; mono?: boolean }> = {
  openai: { label: "OpenAI", logo: "/providers/openai.svg", mono: true },
  groq: { label: "Groq", logo: "/providers/groq.svg", mono: true },
  krutrim: { label: "Kupe", logo: "/brand/kupe-mark.png" },
  eleven_labs: { label: "ElevenLabs", logo: "/providers/elevenlabs.svg", mono: true },
  elevenlabs: { label: "ElevenLabs", logo: "/providers/elevenlabs.svg", mono: true },
  cartesia: { label: "Cartesia", logo: "/providers/cartesia.png" },
  // Licensed white-label: shown as "Kupe" everywhere, not "Soniox".
  soniox: { label: "Kupe", logo: "/brand/kupe-mark.png" },
  kupe: { label: "Kupe", logo: "/brand/kupe-mark.png" },
  grok_tts: { label: "Grok", logo: "/providers/grok.svg", mono: true },
  grok: { label: "Grok", logo: "/providers/grok.svg", mono: true },
  sarvam: { label: "Sarvam", logo: "/providers/sarvam.svg" },
  smallest_ai: { label: "Smallest AI", logo: "/providers/smallest-ai.png" },
  deepgram: { label: "Deepgram", logo: "/providers/deepgram.svg" },
  assembly_ai: { label: "AssemblyAI", logo: "/providers/assemblyai.svg", mono: true },
  assemblyai: { label: "AssemblyAI", logo: "/providers/assemblyai.svg", mono: true },
  speechmatics: { label: "Speechmatics", logo: "/providers/speechmatics.png" },
};

export function providerKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function displayProviderName(name: string, model?: string): string {
  if (isSarvamLlmModel(name, model)) return KAI_BRAND.label;
  const known = BRANDS[providerKey(name)];
  if (known) return known.label;
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bTts\b/g, "TTS")
    .replace(/\bStt\b/g, "STT");
}

const MODEL_ACRONYMS = new Set([
  "ai",
  "asr",
  "en",
  "gpt",
  "hd",
  "it",
  "llm",
  "oss",
  "rt",
  "stt",
  "tts",
  "vad",
]);

/** Humanize catalog ids like `eleven_flash_v2_5` → `Eleven Flash v2.5`. */
export function displayModelName(name: string): string {
  let raw = name.trim();
  if (!raw) return raw;
  if (/^k-STT$/i.test(raw)) return "k-STT";
  if (/^k-TTS$/i.test(raw)) return "k-TTS";
  const slash = raw.lastIndexOf("/");
  if (slash >= 0) raw = raw.slice(slash + 1);
  raw = raw.replace(/[vV](\d+)_(\d+)/g, "v$1.$2");

  return raw
    .split(/[:_\-\s]+/)
    .filter(Boolean)
    .flatMap((token) => {
      if (/^v\d+(\.\d+)*$/i.test(token) || /^[eaEA]\d+[bB]$/.test(token)) return [token];
      return token.replace(/([a-zA-Z])(\d)/g, "$1 $2").split(" ");
    })
    .filter(Boolean)
    .map(formatModelToken)
    .join(" ");
}

/** Soniox STT/TTS keep internal ids in storage; UI always shows k-STT / k-TTS. */
export function brandedModelName(provider: string, model: string): string {
  const p = providerKey(provider);
  const m = model.trim().toLowerCase();
  if (p === "soniox" || p === "kupe") {
    if (m.startsWith("tts") || m === "k-tts") return "k-TTS";
    if (m.startsWith("stt") || m === "k-stt") return "k-STT";
  }
  // Sarvam's own flagship LLM literally has "sarvam" in its model id --
  // keep that out of the (now Kai-branded) model text. glm-5.2 /
  // gemma-4-31b are already brand-neutral, so displayModelName is fine.
  if (isSarvamLlmModel(provider, model) && m === "sarvam-105b") return "Kai 105B";
  return displayModelName(model);
}

function formatModelToken(token: string): string {
  if (/^v\d+(\.\d+)*$/i.test(token)) return `v${token.slice(1)}`;
  if (/^\d+(\.\d+)+$/.test(token) || /^\d{4}$/.test(token)) return token;
  if (/^\d+[bB]$/.test(token) || /^[eaEA]\d+[bB]$/.test(token)) return token.toUpperCase();
  if (/^\d+o$/i.test(token)) return token.toLowerCase();
  const lower = token.toLowerCase();
  if (MODEL_ACRONYMS.has(lower)) return token.toUpperCase();
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** `Kupe / k-TTS` — provider display name, then branded/humanized model. */
export function formatProviderModel(provider: string, model: string): string {
  const p = displayProviderName(provider, model);
  const m = brandedModelName(provider, model);
  if (!p) return m;
  if (!m) return p;
  return `${p} / ${m}`;
}

export function providerLogoSrc(name: string, model?: string): string | null {
  if (isSarvamLlmModel(name, model)) return KAI_BRAND.logo;
  return BRANDS[providerKey(name)]?.logo ?? null;
}

export function providerLogoIsMono(name: string, model?: string): boolean {
  if (isSarvamLlmModel(name, model)) return false;
  return Boolean(BRANDS[providerKey(name)]?.mono);
}

export function providerInitials(name: string, model?: string): string {
  const label = displayProviderName(name, model);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
