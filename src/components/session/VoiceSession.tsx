import { useState } from "react";
import {
  BarVisualizer,
  ConnectionStateToast,
  LiveKitRoom,
  RoomAudioRenderer,
  RoomName,
  useConnectionState,
  useDataChannel,
  useRoomContext,
  useVoiceAssistant,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import LatencyPanel from "@/LatencyPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SessionInfo, TranscriptMessage } from "@/types";

type TranscriptEntry = TranscriptMessage & { id: string };

function statusVariant(state: ConnectionState) {
  if (state === ConnectionState.Connected) return "success" as const;
  if (state === ConnectionState.Connecting || state === ConnectionState.Reconnecting) return "warning" as const;
  return "secondary" as const;
}

function SessionStatus() {
  const state = useConnectionState();
  const label =
    state === ConnectionState.Connected
      ? "Connected"
      : state === ConnectionState.Connecting
        ? "Connecting"
        : state === ConnectionState.Reconnecting
          ? "Reconnecting"
          : "Disconnected";
  return <Badge variant={statusVariant(state)}>{label}</Badge>;
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

function TranscriptPanel() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const { agentTranscriptions } = useVoiceAssistant();

  useDataChannel((msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as TranscriptMessage;
      if (parsed.kind === "transcript" && parsed.role && parsed.text) {
        setEntries((prev) => [
          ...prev,
          { ...parsed, id: `${parsed.role}-${prev.length}-${parsed.text.slice(0, 12)}` },
        ]);
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
                  </div>
                  <div className="text-sm text-foreground">{entry.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
      <ToolCallExecutor />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SessionStatus />
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

      <AgentVisualizer />

      <div className="grid gap-4 lg:grid-cols-2">
        <TranscriptPanel />
        <LatencyPanel />
      </div>
    </LiveKitRoom>
  );
}
