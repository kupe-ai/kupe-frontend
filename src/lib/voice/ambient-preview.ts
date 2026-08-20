/** Built-in ambient loops shipped in `public/ambient`. Display names are the
 * stem only — never `cafe.wav`. */
export const AMBIENT_PRESETS = [
  { id: "office", label: "office" },
  { id: "cafe", label: "cafe" },
  { id: "rain", label: "rain" },
] as const;

export type AmbientPresetId = (typeof AMBIENT_PRESETS)[number]["id"];

export function ambientSrc(id: string): string {
  return `/ambient/${id}.wav`;
}

export function isAmbientPresetId(id: string): id is AmbientPresetId {
  return AMBIENT_PRESETS.some((p) => p.id === id);
}

/** Legacy settings used `quiet-office` for the office loop. */
export function normalizeAmbientId(id: string | undefined | null): string {
  if (!id || id === "none") return "none";
  if (id === "quiet-office") return "office";
  return id.replace(/\.(wav|mp3|ogg|m4a)$/i, "");
}

const LOG_MIN = 0.001;

/** Slider 0–1000 → mixer gain 0–1. Zero is mute; the rest is exponential so
 * the quiet end has more travel, matching how loudness is heard. */
export function sliderToGain(pos: number): number {
  if (pos <= 0) return 0;
  const t = Math.min(1, pos / 1000);
  return LOG_MIN * Math.pow(1 / LOG_MIN, t);
}

export function gainToSlider(gain: number): number {
  if (gain <= 0) return 0;
  const g = Math.max(LOG_MIN, Math.min(1, gain));
  return 1000 * (Math.log(g / LOG_MIN) / Math.log(1 / LOG_MIN));
}

/** Stored background_volume is 0–100 percent of linear mixer gain. */
export function percentToSlider(percent: number): number {
  return gainToSlider(Math.max(0, Math.min(100, percent)) / 100);
}

export function sliderToPercent(pos: number): number {
  return Math.round(sliderToGain(pos) * 100);
}

/** Bandpass tightness 0–100: wide room tone → telephone-narrow. */
export function bandpassHz(tightness: number): { low: number; high: number } {
  const t = Math.max(0, Math.min(100, tightness)) / 100;
  return {
    low: 80 + (300 - 80) * t,
    high: 12000 + (3400 - 12000) * t,
  };
}

export class AmbientPreviewPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private currentId: string | null = null;
  playing = false;

  private async ensureCtx(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  private async load(id: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    const ctx = await this.ensureCtx();
    const res = await fetch(ambientSrc(id));
    if (!res.ok) throw new Error(`Couldn't load ${id} ambient loop`);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    this.buffers.set(id, buf);
    return buf;
  }

  private connectGraph(bandpass: boolean) {
    if (!this.source || !this.gain || !this.highpass || !this.lowpass || !this.ctx) return;
    this.source.disconnect();
    this.gain.disconnect();
    this.highpass.disconnect();
    this.lowpass.disconnect();
    this.source.connect(this.gain);
    if (bandpass) {
      this.gain.connect(this.highpass);
      this.highpass.connect(this.lowpass);
      this.lowpass.connect(this.ctx.destination);
    } else {
      this.gain.connect(this.ctx.destination);
    }
  }

  async play(id: string, gain: number, bandpass: boolean, tightness: number) {
    if (!isAmbientPresetId(id)) return;
    const ctx = await this.ensureCtx();
    const buffer = await this.load(id);
    this.stopSource();
    this.gain = ctx.createGain();
    this.gain.gain.value = gain;
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = "highpass";
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = "lowpass";
    this.applyBandpass(tightness);
    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.connectGraph(bandpass);
    this.source.start(0);
    this.currentId = id;
    this.playing = true;
  }

  setGain(gain: number) {
    if (this.gain) this.gain.gain.value = gain;
  }

  setBandpass(enabled: boolean, tightness: number) {
    this.applyBandpass(tightness);
    if (this.source && this.playing) this.connectGraph(enabled);
  }

  async switchTrack(id: string, gain: number, bandpass: boolean, tightness: number) {
    if (!this.playing) return;
    await this.play(id, gain, bandpass, tightness);
  }

  stop() {
    this.stopSource();
    this.playing = false;
    this.currentId = null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.buffers.clear();
  }

  private applyBandpass(tightness: number) {
    const { low, high } = bandpassHz(tightness);
    if (this.highpass) this.highpass.frequency.value = low;
    if (this.lowpass) this.lowpass.frequency.value = high;
  }

  private stopSource() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      try {
        this.source.disconnect();
      } catch {
        // not connected
      }
      this.source = null;
    }
  }
}
