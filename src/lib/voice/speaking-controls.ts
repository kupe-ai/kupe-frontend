import type { SpeakingControl } from "@/types";

const CARTESIA_EMOTIONS: { value: string; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "happy", label: "Happy" },
  { value: "excited", label: "Excited" },
  { value: "content", label: "Content" },
  { value: "calm", label: "Calm" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "scared", label: "Scared" },
  { value: "curious", label: "Curious" },
  { value: "grateful", label: "Grateful" },
];

function range(
  key: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
  fallback: number,
  format: "multiplier" | "decimal" = "decimal",
): SpeakingControl {
  return { key, label, description, kind: "range", min, max, step, default: fallback, format };
}

function speedControl(provider: string, model: string): SpeakingControl {
  const bounds: Record<string, [number, number, number]> = {
    openai: [0.25, 4, 0.05],
    eleven_labs: [0.7, 1.2, 0.05],
    soniox: [0.7, 1.3, 0.05],
    kupe: [0.7, 1.3, 0.05],
    smallest_ai: [0.5, 2, 0.05],
    cartesia: [0.6, 1.5, 0.05],
    deepgram: [0.5, 2, 0.05],
    sarvam: model.startsWith("bulbul:v3") ? [0.5, 2, 0.05] : [0.3, 3, 0.05],
  };
  const [min, max, step] = bounds[provider] ?? [0.7, 1.4, 0.05];
  return range("speaking_speed", "Speaking speed", "How fast the agent talks.", min, max, step, 1, "multiplier");
}

/** Knobs the selected TTS model honors. Mirrors backend provider_capabilities. */
export function speakingControlsFor(providerName?: string | null, modelName?: string | null): SpeakingControl[] {
  const name = (providerName || "").trim().toLowerCase();
  const model = (modelName || "").trim().toLowerCase();
  const sarvamV3 = name === "sarvam" && model.startsWith("bulbul:v3");
  const controls: SpeakingControl[] = [];

  if (["openai", "deepgram", "eleven_labs", "sarvam", "smallest_ai", "soniox", "kupe", "cartesia"].includes(name)) {
    controls.push(speedControl(name, model));
  }
  if ((name === "deepgram" || name === "sarvam") && !sarvamV3) {
    controls.push(range("pitch", "Pitch", "Voice pitch offset.", -5, 5, 0.25, 0));
  }
  if (name === "sarvam" && !sarvamV3) {
    controls.push(
      range("loudness", "Loudness", "How loud the synthesized voice is.", 0.3, 3, 0.05, 1, "multiplier"),
    );
  }
  if (sarvamV3) {
    controls.push(
      range("temperature", "Voice temperature", "Higher values make delivery more varied.", 0.01, 1, 0.01, 0.6),
    );
  }
  if (name === "cartesia") {
    controls.push(range("volume", "Volume", "How loud Cartesia renders the voice.", 0.5, 2, 0.05, 1, "multiplier"));
    controls.push({
      key: "emotion",
      label: "Emotion",
      description: "Guides the tone of the voice.",
      kind: "select",
      default: "neutral",
      options: CARTESIA_EMOTIONS,
    });
  }
  if (name === "eleven_labs") {
    controls.push(
      range("stability", "Stability", "Lower is more expressive; higher is more consistent.", 0, 1, 0.05, 0.5),
      range("similarity_boost", "Similarity", "How closely the voice matches the selected identity.", 0, 1, 0.05, 0.75),
      range("style", "Style", "How strongly style exaggeration is applied.", 0, 1, 0.05, 0),
    );
    controls.push({
      key: "speaker_boost",
      label: "Speaker boost",
      description: "Enhance clarity and presence of the selected voice.",
      kind: "toggle",
      default: true,
    });
  }
  return controls;
}

export function resolveSpeakingControls(
  providerName?: string | null,
  modelName?: string | null,
  apiSpeaking?: SpeakingControl[] | null,
): SpeakingControl[] {
  if (apiSpeaking && apiSpeaking.length > 0) return apiSpeaking;
  return speakingControlsFor(providerName, modelName);
}
