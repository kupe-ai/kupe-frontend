import { useCallback, useRef, useState } from "react";
import { Phone } from "lucide-react";
import AgentPicker from "@/AgentPicker";
import AuthPanel from "@/AuthPanel";
import { AgentBuilderPage } from "@/AgentBuilderPage";
import { AgentsPanel } from "@/AgentsPanel";
import HistoryPanel from "@/HistoryPanel";
import { PostCallAnalysesPanel } from "@/PostCallAnalysesPanel";
import { SettingsPanel } from "@/SettingsPanel";
import { ToolsPanel } from "@/ToolsPanel";
import ProvidersPanel from "@/ProvidersPanel";
import { RecordingsPanel } from "@/RecordingsPanel";
import { UsagePanel } from "@/UsagePanel";
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
  const {
    orgs,
    org,
    projects,
    project,
    membership,
    loading: orgLoading,
    error: orgError,
    selectOrg,
    selectProject,
    refresh: refreshOrg,
  } = useOrgContext(true);

  const [view, setView] = useState<AppView>("voice");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [selection, setSelection] = useState<ProviderSelection | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [builderAgentId, setBuilderAgentId] = useState<string | null>(null);
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
    // Post-call analyses and flow come from the agent (configured in the builder).
    const target = agentId ? { agent_id: agentId } : selection ? { ...selection } : null;
    if (!target) return;
    setConnecting(true);
    setError(null);
    endingRef.current = false;
    try {
      const data = await api.createSession({
        ...target,
        org_id: org.id,
        project_id: project.id,
      });
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
      description: "Open the builder to configure prompts, flow, features, tools, and post-call analyses.",
    },
    "agent-builder": {
      title: "Agent builder",
      description: "Edit identity, voice stack, conversation flow, features, and attachments.",
    },
    analyses: {
      title: "Post-call analyses",
      description: "Define structured grading runs, then attach them on an agent.",
    },
    tools: {
      title: "Tools",
      description: "Org catalog of client and HTTP tools to attach to agents and analyses.",
    },
    settings: {
      title: "Settings",
      description: "Organizations, projects, members, and API keys.",
    },
    usage: {
      title: "Usage",
      description: "Per-call token and provider usage for this organization.",
    },
    recordings: {
      title: "Recordings",
      description: "Browse and play call recordings.",
    },
    session: {
      title: "Live session",
      description: "Connected voice room with LiveKit controls and metrics.",
    },
  };

  const meta = titles[view];
  const flush = view === "agent-builder";

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
      projectName={project?.name}
      onSignOut={() => void signOut()}
      sessionActive={Boolean(info)}
      title={meta.title}
      description={meta.description}
      flush={flush}
    >
      {orgError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{orgError}</AlertDescription>
        </Alert>
      )}

      {org && view === "settings" && !info && (
        <SettingsPanel
          orgs={orgs}
          org={org}
          projects={projects}
          project={project}
          membership={membership}
          onSelectOrg={selectOrg}
          onSelectProject={selectProject}
          onRefresh={refreshOrg}
        />
      )}

      {org && project && (
        <>
          {view === "agents" && !info && (
            <AgentsPanel
              orgId={org.id}
              projectId={project.id}
              onCreate={() => {
                setBuilderAgentId(null);
                setView("agent-builder");
              }}
              onOpen={(id) => {
                setBuilderAgentId(id);
                setView("agent-builder");
              }}
            />
          )}
          {view === "agent-builder" && !info && (
            <AgentBuilderPage
              orgId={org.id}
              projectId={project.id}
              agentId={builderAgentId}
              onBack={() => setView("agents")}
              onSaved={(agent) => setBuilderAgentId(agent.id)}
            />
          )}
          {view === "analyses" && !info && <PostCallAnalysesPanel orgId={org.id} />}
          {view === "tools" && !info && <ToolsPanel orgId={org.id} />}
          {view === "usage" && !info && <UsagePanel orgId={org.id} />}
          {view === "recordings" && !info && <RecordingsPanel orgId={org.id} />}

          {view === "voice" && !info && (
            <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Start a call</CardTitle>
                  <CardDescription>
                    Prefer a saved agent. Its conversation flow (if any) is used automatically.
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
                    className="w-full cursor-pointer"
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
