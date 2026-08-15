import { useEffect, useState } from "react";
import {
  BarVisualizer,
  ConnectionStateToast,
  LiveKitRoom,
  RoomAudioRenderer,
  RoomName,
  useConnectionState,
  useDataChannel,
  useRoomContext,
  useSpeakingParticipants,
  useVoiceAssistant,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import { ConnectionState, ParticipantKind, RoomEvent, type Participant } from "livekit-client";
import { Loader2 } from "lucide-react";
import LatencyPanel from "@/LatencyPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SessionInfo, TranscriptMessage } from "@/types";

type TranscriptEntry = TranscriptMessage & { id: string };

function isAgentParticipant(participant: Participant) {
  return participant.kind === ParticipantKind.AGENT || participant.identity.startsWith("agent-");
}

function agentIsPending(state: string) {
  return state === "connecting" || state === "initializing";
}

function useAgentHasStartedSpeaking() {
  const { state } = useVoiceAssistant();
  const speakers = useSpeakingParticipants();
  const [started, setStarted] = useState(false);

  const agentSpeaking = speakers.some(isAgentParticipant);

  useEffect(() => {
    if (started) return;
    if (state === "speaking" || agentSpeaking) {
      setStarted(true);
    }
  }, [started, state, agentSpeaking]);

  return started;
}

function SessionStatus({ heardAgent }: { heardAgent: boolean }) {
  const roomState = useConnectionState();
  const { state } = useVoiceAssistant();

  if (roomState === ConnectionState.Reconnecting) {
    return <Badge variant="warning">Reconnecting</Badge>;
  }
  if (roomState === ConnectionState.Disconnected || state === "disconnected") {
    return <Badge variant="secondary">Disconnected</Badge>;
  }
  if (!heardAgent && agentIsPending(state)) {
    return <Badge variant="warning">Connecting</Badge>;
  }
  return (
    <Badge variant="success" className="capitalize">
      {heardAgent && agentIsPending(state) ? "speaking" : state}
    </Badge>
  );
}

function AgentVisualizer() {
  const { state, audioTrack } = useVoiceAssistant();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-6 [contain:layout_paint]">
      <Badge variant="outline" className="capitalize">
        Agent · {state}
      </Badge>
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        barCount={12}
        options={{ minHeight: 8, maxHeight: 80 }}
        className="h-24 w-full max-w-md"
      />
    </div>
  );
}

function executeClientTool(name: string, rawArgs: string): string {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    args = {};
  }
  if (name === "get_current_time") {
    return JSON.stringify({ now: new Date().toISOString() });
  }
  if (name === "transfer_to_human") {
    return JSON.stringify({ status: "transfer_requested", reason: args.reason ?? null });
  }
  if (name === "end_call") {
    return JSON.stringify({ status: "ending" });
  }
  return JSON.stringify({ status: "acknowledged", name, arguments: args });
}

function DisconnectWhenAgentLeaves() {
  const room = useRoomContext();

  useEffect(() => {
    let seenAgent = [...room.remoteParticipants.values()].some(isAgentParticipant);

    const onConnected = (participant: Participant) => {
      if (isAgentParticipant(participant)) seenAgent = true;
    };
    const onDisconnected = (participant: Participant) => {
      if (isAgentParticipant(participant) && seenAgent) {
        void room.disconnect();
      }
    };

    room.on(RoomEvent.ParticipantConnected, onConnected);
    room.on(RoomEvent.ParticipantDisconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onConnected);
      room.off(RoomEvent.ParticipantDisconnected, onDisconnected);
    };
  }, [room]);

  return null;
}

function ToolCallExecutor() {
  const room = useRoomContext();
  useDataChannel((msg) => {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(msg.payload)) as {
        kind?: string;
        call_id?: string;
        name?: string;
        arguments?: string;
      };
      if (parsed.kind !== "tool_call" || !parsed.call_id || !parsed.name) return;
      const output = executeClientTool(parsed.name, parsed.arguments ?? "");
      void room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ kind: "tool_call_output", call_id: parsed.call_id, output })),
        { reliable: true },
      );
      if (parsed.name === "end_call") {
        void room.disconnect();
      }
    } catch {
      // ignore non-tool messages
    }
  });
  return null;
}

function applyTranscriptMessage(prev: TranscriptEntry[], parsed: TranscriptMessage): TranscriptEntry[] {
  const isFinal = parsed.final !== false;
  const openIdx = prev.findLastIndex((e) => e.role === parsed.role && e.final === false);

  if (!isFinal) {
    if (openIdx >= 0) {
      const next = [...prev];
      next[openIdx] = { ...next[openIdx], text: parsed.text, final: false };
      return next;
    }
    return [
      ...prev,
      {
        ...parsed,
        final: false,
        id: `${parsed.role}-live-${prev.length}`,
      },
    ];
  }

  if (openIdx >= 0) {
    const next = [...prev];
    next[openIdx] = {
      ...next[openIdx],
      text: parsed.text,
      final: true,
    };
    return next;
  }

  return [
    ...prev,
    {
      ...parsed,
      final: true,
      id: `${parsed.role}-${prev.length}-${parsed.text.slice(0, 12)}`,
    },
  ];
}

function TranscriptPanel() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const { agentTranscriptions } = useVoiceAssistant();

  useDataChannel((msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as TranscriptMessage;
      if (parsed.kind === "transcript" && parsed.role && parsed.text) {
        setEntries((prev) => applyTranscriptMessage(prev, parsed));
      }
    } catch {
      // ignore non-transcript data messages
    }
  });

  const livekitLines = agentTranscriptions
    .filter((t) => t.text.trim())
    .map((t) => ({
      id: t.id,
      role: "assistant" as const,
      text: t.text,
      kind: "transcript" as const,
      final: true,
    }));

  const lines = entries.length > 0 ? entries : livekitLines;

  return (
    <Card className="flex h-full min-h-[320px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Transcript</CardTitle>
        <CardDescription>Live turns from the session data channel and agent track.</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className="h-[340px] overflow-y-auto overscroll-contain rounded-md border border-border bg-muted/30 p-3">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Say something to start the conversation.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {lines.map((entry) => (
                <div key={entry.id} className="text-left">
                  <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {entry.role === "user" ? "You" : "Agent"}
                    {entry.final === false ? " · listening" : ""}
                  </div>
                  <div className={`text-sm text-foreground${entry.final === false ? " opacity-70" : ""}`}>
                    {entry.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectingPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connecting</CardTitle>
        <CardDescription>Stay here until the agent begins speaking.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Waiting for the agent…</p>
      </CardContent>
    </Card>
  );
}

function SessionView({ roomError }: { roomError: string | null }) {
  const { state } = useVoiceAssistant();
  const heardAgent = useAgentHasStartedSpeaking();
  const pending = !heardAgent && agentIsPending(state);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SessionStatus heardAgent={heardAgent} />
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <RoomName className="font-mono text-xs text-muted-foreground" />
        </div>
        <VoiceAssistantControlBar controls={{ microphone: true, leave: true }} />
      </div>

      {roomError && (
        <Alert variant="destructive">
          <AlertDescription>{roomError}</AlertDescription>
        </Alert>
      )}

      {pending ? (
        <ConnectingPanel />
      ) : (
        <>
          <AgentVisualizer />
          <div className="grid gap-4 lg:grid-cols-2">
            <TranscriptPanel />
            <LatencyPanel />
          </div>
        </>
      )}
    </>
  );
}

export function VoiceSession({ info, onEnd }: { info: SessionInfo; onEnd: () => void }) {
  const [roomError, setRoomError] = useState<string | null>(null);

  if (!info.ws_url || !info.token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Session has no LiveKit connection info.</AlertDescription>
      </Alert>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={info.ws_url}
      token={info.token}
      connect
      audio
      video={false}
      onError={(err) => setRoomError(err.message)}
      onDisconnected={() => {
        onEnd();
      }}
      className="flex flex-col gap-4"
    >
      <RoomAudioRenderer />
      <ConnectionStateToast />
      <DisconnectWhenAgentLeaves />
      <ToolCallExecutor />
      <SessionView roomError={roomError} />
    </LiveKitRoom>
  );
}
