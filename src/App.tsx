import { useCallback, useRef, useState } from "react";
import { Phone } from "lucide-react";
import AgentPicker from "@/AgentPicker";
import AuthPanel from "@/AuthPanel";
import { AgentsPanel } from "@/AgentsPanel";
import HistoryPanel from "@/HistoryPanel";
import { PostCallAnalysesPanel } from "@/PostCallAnalysesPanel";
import ProvidersPanel from "@/ProvidersPanel";
import { AppShell } from "@/components/layout/AppShell";
import type { AppView } from "@/components/layout/AppSidebar";
import { VoiceSession } from "@/components/session/VoiceSession";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useOrgContext } from "@/lib/useOrgContext";
import type { ProviderSelection, SessionInfo } from "@/types";

function VoiceApp() {
  const { session, signOut } = useAuth();
  const { org, project, loading: orgLoading, error: orgError } = useOrgContext(true);

  const [view, setView] = useState<AppView>("voice");
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
      setView("voice");
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
      setView("session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }, [agentId, selection, org, project]);

  const handleEnd = useCallback(() => {
    if (info) void endSession(info);
  }, [info, endSession]);

  const titles: Record<AppView, { title: string; description: string }> = {
    voice: {
      title: "Voice",
      description: "Pick an agent or providers and start a LiveKit session.",
    },
    agents: {
      title: "Agents",
      description: "Create and version voice agents for this project.",
    },
    analyses: {
      title: "Post-call analyses",
      description: "Define structured grading runs for completed sessions.",
    },
    session: {
      title: "Live session",
      description: "Connected voice room with LiveKit controls and metrics.",
    },
  };

  const meta = titles[view];

  if (orgLoading) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Setting up your organization…</p>
      </div>
    );
  }

  return (
    <AppShell
      view={view}
      onNavigate={(next) => {
        if (!info) setView(next);
      }}
      email={session?.user.email}
      orgName={org?.name}
      onSignOut={() => void signOut()}
      sessionActive={Boolean(info)}
      title={meta.title}
      description={meta.description}
    >
      {orgError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{orgError}</AlertDescription>
        </Alert>
      )}

      {org && project && (
        <>
          {view === "agents" && !info && <AgentsPanel orgId={org.id} projectId={project.id} />}
          {view === "analyses" && !info && <PostCallAnalysesPanel orgId={org.id} />}

          {view === "voice" && !info && (
            <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Start a call</CardTitle>
                  <CardDescription>
                    Prefer a saved agent; otherwise pick providers for this session only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AgentPicker
                    orgId={org.id}
                    projectId={project.id}
                    agentId={agentId}
                    onChange={setAgentId}
                  />
                  {!agentId && <ProvidersPanel selection={selection} onChange={setSelection} />}
                  <Button
                    className="w-full"
                    onClick={() => void handleConnect()}
                    disabled={connecting || (!agentId && !selection)}
                  >
                    <Phone className="h-4 w-4" />
                    {connecting ? "Connecting…" : "Connect"}
                  </Button>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              <HistoryPanel org={org} refreshKey={historyKey} />
            </div>
          )}

          {view === "session" && info && <VoiceSession info={info} onEnd={handleEnd} />}
        </>
      )}
    </AppShell>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-6 overflow-y-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Kupe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Voice agent console</p>
        </div>
        <AuthPanel />
      </div>
    );
  }

  return <VoiceApp />;
}
