/** Display names + logo files for LLM / TTS / STT catalog providers. */

const BRANDS: Record<string, { label: string; logo: string; mono?: boolean }> = {
  openai: { label: "OpenAI", logo: "/providers/openai.svg", mono: true },
  groq: { label: "Groq", logo: "/providers/groq.svg", mono: true },
  krutrim: { label: "Krutrim", logo: "/providers/krutrim.png" },
  eleven_labs: { label: "ElevenLabs", logo: "/providers/elevenlabs.svg", mono: true },
  elevenlabs: { label: "ElevenLabs", logo: "/providers/elevenlabs.svg", mono: true },
  cartesia: { label: "Cartesia", logo: "/providers/cartesia.png" },
  soniox: { label: "Soniox", logo: "/providers/soniox.png" },
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

export function displayProviderName(name: string): string {
  const known = BRANDS[providerKey(name)];
  if (known) return known.label;
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bTts\b/g, "TTS")
    .replace(/\bStt\b/g, "STT");
}

export function providerLogoSrc(name: string): string | null {
  return BRANDS[providerKey(name)]?.logo ?? null;
}

export function providerLogoIsMono(name: string): boolean {
  return Boolean(BRANDS[providerKey(name)]?.mono);
}

export function providerInitials(name: string): string {
  const label = displayProviderName(name);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
