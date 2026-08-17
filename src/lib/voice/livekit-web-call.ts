"use client";

import {
  ParticipantKind,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type Participant,
  type RemoteTrack,
} from "livekit-client";
import { api } from "@/lib/api";
import { captureEvent } from "@/lib/posthog";
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
  /** Live 0-1 amplitude of the agent's published track (from LiveKit RTP
   * levels — no extra Web Audio graph on the playback track). */
  onAgentAudioLevel?: (level: number) => void;
  /** Fired once with a clone of the agent's audio track for visualizers.
   * Cloned so analysis cannot steal samples from playback. */
  onAgentTrack?: (track: MediaStreamTrack) => void;
  /** Clone of the local microphone track for the listening visualizer. */
  onLocalTrack?: (track: MediaStreamTrack) => void;
  onError?: (error: unknown) => void;
}

async function hangUpSession(callId: string | undefined) {
  if (!callId) return;
  await api.endSession(callId).catch(() => undefined);
}

function attachRemoteAudio(track: RemoteTrack, attached: HTMLMediaElement[]) {
  const el = track.attach();
  el.autoplay = true;
  el.setAttribute("playsinline", "true");
  el.style.display = "none";
  document.body.appendChild(el);
  attached.push(el);
  void el.play().catch(() => undefined);
}

function emitLocalMic(
  pub: LocalTrackPublication,
  callbacks: WebCallCallbacks,
  clones: MediaStreamTrack[],
  seen: Set<string>,
) {
  if (pub.source !== Track.Source.Microphone || !pub.track) return;
  const id = pub.trackSid || pub.track.sid;
  if (id && seen.has(id)) return;
  if (id) seen.add(id);
  const cloned = pub.track.mediaStreamTrack.clone();
  clones.push(cloned);
  callbacks.onLocalTrack?.(cloned);
}

function isAgentParticipant(participant: Participant) {
  return participant.kind === ParticipantKind.AGENT || participant.identity.startsWith("agent-");
}

/** Connects the browser mic to a LiveKit room for a "Test Agent" call:
 * requests a room+token from the backend, joins over WebRTC, publishes the
 * mic, and plays back the agent's synthesized audio track. */
export async function startWebCall(
  agentId: string,
  callbacks: WebCallCallbacks = {},
  variables?: Record<string, string>,
): Promise<WebCallHandle> {
  callbacks.onStatusChange?.("connecting");
  const attached: HTMLMediaElement[] = [];
  const clones: MediaStreamTrack[] = [];
  let levelRaf = 0;
  let callId: string | undefined;

  try {
    const { call_id, access_token, livekit_url } = await createWebCall(agentId, variables);
    callId = call_id;
    if (!livekit_url) {
      throw new Error("Server did not return a LiveKit URL — check voice.livekit_url in config.");
    }
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      publishDefaults: {
        dtx: true,
        red: true,
        stopMicTrackOnMute: true,
      },
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });

    const seenLocal = new Set<string>();

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      attachRemoteAudio(track, attached);
      const cloned = track.mediaStreamTrack.clone();
      clones.push(cloned);
      callbacks.onAgentTrack?.(cloned);
    });

    room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
      emitLocalMic(pub, callbacks, clones, seenLocal);
    });

    room.on(RoomEvent.Disconnected, () => callbacks.onStatusChange?.("ended"));

    await room.connect(livekit_url, access_token);
    await room.localParticipant.setMicrophoneEnabled(true);

    for (const pub of room.localParticipant.audioTrackPublications.values()) {
      emitLocalMic(pub, callbacks, clones, seenLocal);
    }

    const pumpAgentLevel = () => {
      let max = 0;
      let speaking = false;
      room.remoteParticipants.forEach((p) => {
        if (p.audioLevel > max) max = p.audioLevel;
        if (p.isSpeaking) speaking = true;
      });
      // LiveKit isSpeaking is the reliable switch; audioLevel alone can sit
      // under the UI's 0.04 threshold and never flip the visualizer.
      callbacks.onAgentAudioLevel?.(speaking ? Math.max(max, 0.2) : max);
      if (room.state === "connected") {
        levelRaf = requestAnimationFrame(pumpAgentLevel);
      }
    };
    if (callbacks.onAgentAudioLevel) {
      levelRaf = requestAnimationFrame(pumpAgentLevel);
    }

    callbacks.onStatusChange?.("connected");
    captureEvent("call_started", { call_id: callId, agent_id: agentId, channel: "web" });

    let hungUp = false;
    const hangUp = async () => {
      if (hungUp) return;
      hungUp = true;
      if (levelRaf) cancelAnimationFrame(levelRaf);
      for (const el of attached) {
        el.remove();
      }
      for (const track of clones) {
        try {
          track.stop();
        } catch {
          // already ended
        }
      }
      await room.disconnect();
      await hangUpSession(callId);
    };

    // end_call drops the agent out of the room; hang up here so the timer
    // and WebRTC connection don't keep running after the bot said goodbye.
    let seenAgent = [...room.remoteParticipants.values()].some(isAgentParticipant);
    room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
      if (isAgentParticipant(participant)) seenAgent = true;
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
      if (isAgentParticipant(participant) && seenAgent) {
        void hangUp();
      }
    });

    return {
      room,
      callId: call_id,
      disconnect: hangUp,
    };
  } catch (error) {
    await hangUpSession(callId);
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
