import { useCallback, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useDataChannel,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState } from "livekit-client";
import AuthPanel from "./AuthPanel";
import AgentPicker from "./AgentPicker";
import { AgentsPanel } from "./AgentsPanel";
import HistoryPanel from "./HistoryPanel";
import LatencyPanel from "./LatencyPanel";
import { PostCallAnalysesPanel } from "./PostCallAnalysesPanel";
import ProvidersPanel from "./ProvidersPanel";
import { api } from "./lib/api";
import { useAuth } from "./lib/useAuth";
import { useOrgContext } from "./lib/useOrgContext";
import type { ProviderSelection, SessionInfo, TranscriptMessage } from "./types";
import "./App.css";

type TranscriptEntry = TranscriptMessage & { id: string };

function TranscriptPanel() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);

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

  return (
    <div className="transcript">
      {entries.length === 0 && <p className="transcript-empty">Say something to start the conversation.</p>}
      {entries.map((entry) => (
        <div key={entry.id} className={`transcript-line transcript-${entry.role}`}>
          <span className="transcript-role">{entry.role === "user" ? "You" : "Agent"}</span>
          <span className="transcript-text">{entry.text}</span>
        </div>
      ))}
    </div>
  );
}

function MicToggle() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  return (
    <button
      className={`mic-toggle ${isMicrophoneEnabled ? "on" : "off"}`}
      onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
    >
      {isMicrophoneEnabled ? "Mute mic" : "Unmute mic"}
    </button>
  );
}

function StatusBadge() {
  const state = useConnectionState();
  const label =
    state === ConnectionState.Connected
      ? "Connected"
      : state === ConnectionState.Connecting
        ? "Connecting..."
        : state === ConnectionState.Reconnecting
          ? "Reconnecting..."
          : "Disconnected";
  return <span className={`status-badge status-${state}`}>{label}</span>;
}

function Session({ info, onEnd }: { info: SessionInfo; onEnd: () => void }) {
  const [roomError, setRoomError] = useState<string | null>(null);

  if (!info.ws_url || !info.token) {
    // Only the livekit transport is wired up in this UI today.
    return <p className="error">Session has no LiveKit connection info.</p>;
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
        // SDK already finished reconnect attempts. Clean up the server session.
        onEnd();
      }}
    >
      <RoomAudioRenderer />
      <div className="session-header">
        <StatusBadge />
        <span className="room-name">{info.room_name}</span>
      </div>
      {roomError && <p className="error">{roomError}</p>}
      <div className="controls">
        <MicToggle />
        <button className="disconnect" onClick={onEnd}>
          Disconnect
        </button>
      </div>
      <div className="session-columns">
        <TranscriptPanel />
        <LatencyPanel />
      </div>
    </LiveKitRoom>
  );
}

type MainView = "voice" | "agents" | "analyses";

function VoiceApp() {
  const { session, signOut } = useAuth();
  const { org, project, loading: orgLoading, error: orgError } = useOrgContext(true);

  const [view, setView] = useState<MainView>("voice");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [selection, setSelection] = useState<ProviderSelection | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const endingRef = useRef(false);

  const endSession = useCallback(async (s: SessionInfo) => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      await api.endSession(s.session_id);
    } catch {
      // room teardown is best-effort; LiveKit empty_timeout is the backstop
    } finally {
      setInfo(null);
      setHistoryKey((k) => k + 1);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!org || !project) return;
    // An agent supersedes raw provider ids -- the backend resolves and
    // snapshots providers from the agent, and sending both would be ambiguous.
    const target = agentId ? { agent_id: agentId } : selection ? { ...selection } : null;
    if (!target) return;
    setConnecting(true);
    setError(null);
    endingRef.current = false;
    try {
      const data = await api.createSession({ ...target, org_id: org.id, project_id: project.id });
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }, [agentId, selection, org, project]);

  const handleEnd = useCallback(() => {
    if (info) void endSession(info);
  }, [info, endSession]);

  return (
    <div className="app">
      <div className="app-header">
        <h1>Kupe Voice Agent</h1>
        <div className="app-header-account">
          <span className="account-email">{session?.user.email}</span>
          {org && <span className="account-org">{org.name}</span>}
          <button className="sign-out" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {orgLoading && <p className="transcript-empty">Setting up your organization...</p>}
      {orgError && <p className="error">{orgError}</p>}

      {!orgLoading && org && project && (
        <>
          {!info && (
            <nav className="main-tabs">
              <button className={view === "voice" ? "active" : ""} onClick={() => setView("voice")}>
                Voice
              </button>
              <button className={view === "agents" ? "active" : ""} onClick={() => setView("agents")}>
                Agents
              </button>
              <button className={view === "analyses" ? "active" : ""} onClick={() => setView("analyses")}>
                Post-Call Analyses
              </button>
            </nav>
          )}

          {view === "agents" && !info && <AgentsPanel orgId={org.id} projectId={project.id} />}
          {view === "analyses" && !info && <PostCallAnalysesPanel orgId={org.id} />}

          {view === "voice" && !info && (
            <div className="connect-screen">
              <AgentPicker
                orgId={org.id}
                projectId={project.id}
                agentId={agentId}
                onChange={setAgentId}
              />
              {!agentId && <ProvidersPanel selection={selection} onChange={setSelection} />}
              <button
                className="connect-button"
                onClick={() => void handleConnect()}
                disabled={connecting || (!agentId && !selection)}
              >
                {connecting ? "Connecting..." : "Connect"}
              </button>
              {error && <p className="error">{error}</p>}
            </div>
          )}
          {info && <Session info={info} onEnd={handleEnd} />}

          {view === "voice" && !info && <HistoryPanel org={org} refreshKey={historyKey} />}
        </>
      )}
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <p className="transcript-empty">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <h1>Kupe Voice Agent</h1>
        <AuthPanel />
      </div>
    );
  }

  return <VoiceApp />;
}
