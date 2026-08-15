"use client";

import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { createWebCall } from "@/lib/api/voice/calls";
import { KoriApiError } from "@/lib/api/kori-errors";

export type WebCallStatus = "idle" | "connecting" | "connected" | "ended" | "error";

export interface WebCallHandle {
  room: Room;
  callId: string;
  disconnect: () => Promise<void>;
}

export interface WebCallCallbacks {
  onStatusChange?: (status: WebCallStatus) => void;
  /** Fired with a live 0-1 amplitude reading of the agent's audio, for a
   * waveform in the Test Agent modal. */
  onAgentAudioLevel?: (level: number) => void;
  onError?: (error: unknown) => void;
}

/** Connects the browser mic to a LiveKit room for a "Test Agent" call:
 * requests a room+token from the backend, joins over WebRTC, publishes the
 * mic, and plays back the agent's synthesized audio track. */
export async function startWebCall(agentId: string, callbacks: WebCallCallbacks = {}): Promise<WebCallHandle> {
  callbacks.onStatusChange?.("connecting");
  const attached: HTMLMediaElement[] = [];
  let audioCtx: AudioContext | null = null;

  try {
    const { call_id, access_token, livekit_url } = await createWebCall(agentId);
    if (!livekit_url) {
      throw new Error("Server did not return a LiveKit URL — check voice.livekit_url in config.");
    }
    const room = new Room({ adaptiveStream: true, dynacast: true });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.autoplay = true;
      document.body.appendChild(el);
      attached.push(el);

      if (callbacks.onAgentAudioLevel) {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
          callbacks.onAgentAudioLevel?.(avg);
          if (room.state === "connected") requestAnimationFrame(tick);
        };
        tick();
      }
    });

    room.on(RoomEvent.Disconnected, () => callbacks.onStatusChange?.("ended"));

    await room.connect(livekit_url, access_token);
    await room.localParticipant.setMicrophoneEnabled(true);
    callbacks.onStatusChange?.("connected");

    return {
      room,
      callId: call_id,
      disconnect: async () => {
        for (const el of attached) {
          el.remove();
        }
        await audioCtx?.close().catch(() => undefined);
        await room.disconnect();
      },
    };
  } catch (error) {
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
