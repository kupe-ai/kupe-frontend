"use client";

import { api } from "@/lib/api";
import { captureEvent, captureException } from "@/lib/posthog";
import { createWebCall } from "@/lib/api/voice/calls";
import { KoriApiError } from "@/lib/api/kori-errors";

export type WebCallStatus = "idle" | "connecting" | "connected" | "ended" | "error";

/** Event names matching livekit-client so Test Agent / Ask Kai stay wired. */
export const RoomEvent = {
  DataReceived: "dataReceived",
  TranscriptionReceived: "transcriptionReceived",
  Disconnected: "disconnected",
} as const;

export type TranscriptionSegment = {
  id: string;
  text: string;
  language: string;
  startTime: number;
  endTime: number;
  final: boolean;
  firstReceivedTime: number;
  lastReceivedTime: number;
};

export type TranscriptionParticipant = {
  isLocal: boolean;
  identity: string;
};

type RoomEventPayloads = {
  [RoomEvent.DataReceived]: [payload: Uint8Array];
  [RoomEvent.TranscriptionReceived]: [segments: TranscriptionSegment[], participant: TranscriptionParticipant];
  [RoomEvent.Disconnected]: [];
};

type RoomEventName = keyof RoomEventPayloads;
type RoomEventHandler<E extends RoomEventName> = (...args: RoomEventPayloads[E]) => void;

class Emitter {
  private listeners = new Map<string, Set<RoomEventHandler<RoomEventName>>>();
  on<E extends RoomEventName>(event: E, handler: RoomEventHandler<E>) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as RoomEventHandler<RoomEventName>);
    return this;
  }
  off<E extends RoomEventName>(event: E, handler: RoomEventHandler<E>) {
    this.listeners.get(event)?.delete(handler as RoomEventHandler<RoomEventName>);
    return this;
  }
  emit<E extends RoomEventName>(event: E, ...args: RoomEventPayloads[E]) {
    for (const handler of this.listeners.get(event) ?? []) handler(...args);
  }
}

class LocalParticipant {
  isLocal = true;
  identity = "user";
  constructor(private setMic: (enabled: boolean) => void) {}
  async setMicrophoneEnabled(enabled: boolean) {
    this.setMic(enabled);
  }
}

export class Room extends Emitter {
  state: "disconnected" | "connected" = "disconnected";
  localParticipant: LocalParticipant;
  constructor(setMic: (enabled: boolean) => void) {
    super();
    this.localParticipant = new LocalParticipant(setMic);
  }
}

export interface WebCallHandle {
  room: Room;
  callId: string;
  disconnect: () => Promise<void>;
}

export interface WebCallCallbacks {
  onStatusChange?: (status: WebCallStatus) => void;
  onAgentAudioLevel?: (level: number) => void;
  onAgentTrack?: (track: MediaStreamTrack) => void;
  onLocalTrack?: (track: MediaStreamTrack) => void;
  onData?: (payload: Uint8Array) => void;
  onError?: (error: unknown) => void;
}

const SAMPLE_RATE = 24000;
/** 20 ms of 24 kHz PCM — same cadence as telephony packets, not the 2.7 ms
 * AudioWorklet quantum. Tiny JSON frames flooded the 24 kHz pipeline and
 * made STT/VAD run late. */
const FRAME_SAMPLES = SAMPLE_RATE / 50;
const CAPTURE_PROCESSOR = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch.slice());
    return true;
  }
}
registerProcessor("kupe-capture", CaptureProcessor);
`;

function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/** Streaming linear resampler that keeps the fractional read head so 48 kHz
 * worklet quanta do not drop samples when the AudioContext is not 24 kHz. */
class StreamResampler {
  private pos = 0;

  resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) {
      this.pos = 0;
      return input;
    }
    const ratio = fromRate / toRate;
    const out: number[] = [];
    let src = this.pos;
    while (src < input.length) {
      const i0 = Math.floor(src);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = src - i0;
      out.push(input[i0] * (1 - frac) + input[i1] * frac);
      src += ratio;
    }
    this.pos = src - input.length;
    return Float32Array.from(out);
  }
}

class PcmFramePacker {
  private buf = new Int16Array(FRAME_SAMPLES);
  private filled = 0;

  push(pcm: ArrayBuffer, send: (frame: ArrayBuffer) => void) {
    const src = new Int16Array(pcm);
    let offset = 0;
    while (offset < src.length) {
      const take = Math.min(this.buf.length - this.filled, src.length - offset);
      this.buf.set(src.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === this.buf.length) {
        send(this.buf.slice().buffer);
        this.filled = 0;
      }
    }
  }
}

function pcm16ToFloat(bytes: ArrayBuffer): Float32Array {
  const view = new Int16Array(bytes);
  const out = new Float32Array(view.length);
  for (let i = 0; i < view.length; i++) out[i] = view[i] / 0x8000;
  return out;
}

function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

class PcmPlayer {
  private ctx: AudioContext;
  private next = 0;
  private primed = false;
  private sources: AudioBufferSourceNode[] = [];
  readonly stream: MediaStream;
  private gain: GainNode;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const dest = this.ctx.createMediaStreamDestination();
    this.stream = dest.stream;
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.gain.connect(dest);
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

    enqueue(pcm: ArrayBuffer) {
    const samples = pcm16ToFloat(pcm);
    if (!samples.length) return;
    const buffer = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    const dest = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) dest[i] = samples[i];
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain);
    let startAt = Math.max(this.ctx.currentTime, this.next);
    if (!this.primed) {
      startAt = this.ctx.currentTime + 0.08;
      this.primed = true;
    }
    src.start(startAt);
    this.next = startAt + buffer.duration;
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
    };
  }

  stop() {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.primed = false;
    this.next = this.ctx.currentTime;
  }

  rms(): number {
    return this.sources.length ? 0.35 : 0;
  }

  async close() {
    this.stop();
    await this.ctx.close().catch(() => undefined);
  }
}

async function hangUpSession(callId: string | undefined) {
  if (!callId) return;
  await api.endSession(callId).catch(() => undefined);
}

function wsUrl(base: string, secret: string): string {
  const url = new URL(base, window.location.href);
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  // The backend's realtime-session response is meant to point at the agents
  // host under /agents/v1/realtime (see kupe-backend's _realtime_ws_url and
  // its test_realtime_sessions assertion). When PUBLIC_AGENTS_WS_URL is
  // misconfigured without the /agents suffix, it instead returns .../v1/realtime,
  // which 404s the WebSocket upgrade ("Couldn't reach the call server").
  // Repair that here so the web-call widget still connects even if the
  // backend value regresses again.
  if (url.pathname === "/v1/realtime") {
    url.pathname = "/agents/v1/realtime";
  }
  url.searchParams.set("client_secret", secret);
  url.searchParams.set("model", "kupe-realtime");
  return url.toString();
}

export async function startWebCall(
  agentId: string,
  callbacks: WebCallCallbacks = {},
  variables?: Record<string, string>,
): Promise<WebCallHandle> {
  callbacks.onStatusChange?.("connecting");
  let callId: string | undefined;
  let hungUp = false;
  let micEnabled = true;
  let captureCtx: AudioContext | null = null;
  let media: MediaStream | null = null;
  let socket: WebSocket | null = null;
  let player: PcmPlayer | null = null;
  let levelRaf = 0;

  const setMic = (enabled: boolean) => {
    micEnabled = enabled;
    for (const track of media?.getAudioTracks() ?? []) track.enabled = enabled;
  };
  const room = new Room(setMic);

  const cleanup = async () => {
    if (hungUp) return;
    hungUp = true;
    if (levelRaf) cancelAnimationFrame(levelRaf);
    player?.stop();
    await player?.close();
    socket?.close();
    captureCtx?.close().catch(() => undefined);
    media?.getTracks().forEach((t) => t.stop());
    room.state = "disconnected";
    room.emit(RoomEvent.Disconnected);
    await hangUpSession(callId);
  };

  try {
    const { call_id, client_secret, websocket_url } = await createWebCall(agentId, variables);
    callId = call_id;
    if (!websocket_url) throw new Error("Server did not return a realtime WebSocket URL.");

    player = new PcmPlayer();
    await player.resume();
    const agentTrack = player.stream.getAudioTracks()[0];
    if (agentTrack) callbacks.onAgentTrack?.(agentTrack);

    media = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        // Browser NS + server RNNoise was double-denoising and starving STT.
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
      },
    });
    const local = media.getAudioTracks()[0];
    if (local) callbacks.onLocalTrack?.(local.clone());

    captureCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    if (captureCtx.state === "suspended") await captureCtx.resume();
    const workletUrl = URL.createObjectURL(new Blob([CAPTURE_PROCESSOR], { type: "text/javascript" }));
    await captureCtx.audioWorklet.addModule(workletUrl);
    URL.revokeObjectURL(workletUrl);
    const source = captureCtx.createMediaStreamSource(media);
    const node = new AudioWorkletNode(captureCtx, "kupe-capture");
    source.connect(node);

    socket = new WebSocket(wsUrl(websocket_url, client_secret));
    await new Promise<void>((resolve, reject) => {
      socket!.onopen = () => resolve();
      socket!.onerror = () => reject(new Error("Realtime WebSocket failed to connect"));
    });

    const resampler = new StreamResampler();
    const packer = new PcmFramePacker();
    node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
      if (!micEnabled || socket?.readyState !== WebSocket.OPEN) return;
      const resampled = resampler.resample(ev.data, captureCtx!.sampleRate, SAMPLE_RATE);
      packer.push(floatToPcm16(resampled), (frame) => {
        socket!.send(JSON.stringify({ type: "input_audio_buffer.append", audio: bytesToB64(frame) }));
      });
    };

    const emitKind = (obj: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      callbacks.onData?.(bytes);
      room.emit(RoomEvent.DataReceived, bytes);
    };

    socket.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      const type = String(msg.type || "");
      if (msg.kind) emitKind(msg);
      if (type === "input_audio_buffer.speech_started") {
        player?.stop();
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "response.cancel" }));
        }
      }
      if (type === "response.output_audio.delta" && typeof msg.delta === "string") {
        const bin = Uint8Array.from(atob(msg.delta), (c) => c.charCodeAt(0));
        player?.enqueue(bin.buffer);
      }
      // Transcripts arrive twice from the agents service: once as
      // {kind:"transcript"} (handled by emitKind above) and once as the
      // OpenAI-compatible event below, for SDK clients. Rendering both put
      // every user and agent turn on screen twice, so the OpenAI events are
      // intentionally not re-emitted into the transcript here.
    };
    socket.onclose = () => {
      void cleanup();
      callbacks.onStatusChange?.("ended");
    };

    const pump = () => {
      callbacks.onAgentAudioLevel?.(player?.rms() ?? 0);
      if (!hungUp) levelRaf = requestAnimationFrame(pump);
    };
    levelRaf = requestAnimationFrame(pump);

    room.state = "connected";
    callbacks.onStatusChange?.("connected");
    captureEvent("call_started", { call_id: callId, agent_id: agentId, channel: "web" });

    return { room, callId: call_id, disconnect: cleanup };
  } catch (error) {
    await cleanup();
    callbacks.onStatusChange?.("error");
    captureException(error, { call_id: callId, agent_id: agentId, channel: "web" });
    callbacks.onError?.(error);
    throw error;
  }
}

export function webCallErrorMessage(error: unknown): string {
  if (error instanceof KoriApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Couldn't connect the call";
}
