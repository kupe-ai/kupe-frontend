"use client";

import { api } from "@/lib/api";
import { captureEvent } from "@/lib/posthog";
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

type Handler = (...args: unknown[]) => void;

class Emitter {
  private listeners = new Map<string, Set<Handler>>();
  on(event: string, handler: Handler) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return this;
  }
  off(event: string, handler: Handler) {
    this.listeners.get(event)?.delete(handler);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
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
const CAPTURE_PROCESSOR = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch);
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

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = src - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
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
    const startAt = Math.max(this.ctx.currentTime, this.next);
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
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    const local = media.getAudioTracks()[0];
    if (local) callbacks.onLocalTrack?.(local.clone());

    captureCtx = new AudioContext();
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

    node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
      if (!micEnabled || socket?.readyState !== WebSocket.OPEN) return;
      const resampled = resample(ev.data, captureCtx!.sampleRate, SAMPLE_RATE);
      const pcm = floatToPcm16(resampled);
      socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: bytesToB64(pcm) }));
    };

    const emitKind = (obj: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      callbacks.onData?.(bytes);
      room.emit(RoomEvent.DataReceived, bytes);
    };

    const emitTranscript = (role: "user" | "agent", text: string, final: boolean, id?: string) => {
      const now = Date.now();
      const seg: TranscriptionSegment = {
        id: id || `${role}-${now}`,
        text,
        language: "en",
        startTime: 0,
        endTime: 0,
        final,
        firstReceivedTime: now,
        lastReceivedTime: now,
      };
      const participant = { isLocal: role === "user", identity: role };
      room.emit(RoomEvent.TranscriptionReceived, [seg], participant);
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
      if (type === "conversation.item.input_audio_transcription.completed" && typeof msg.transcript === "string") {
        emitTranscript("user", msg.transcript, true);
      }
      if (type === "response.output_audio_transcript.done" && typeof msg.transcript === "string") {
        emitTranscript("agent", msg.transcript, true, String(msg.item_id || ""));
      }
      if (type === "response.output_audio_transcript.delta" && typeof msg.delta === "string") {
        emitTranscript("agent", msg.delta, false, String(msg.item_id || ""));
      }
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
    callbacks.onError?.(error);
    throw error;
  }
}

export function webCallErrorMessage(error: unknown): string {
  if (error instanceof KoriApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Couldn't connect the call";
}
