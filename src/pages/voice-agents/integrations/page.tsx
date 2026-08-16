"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, Plug, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusChip } from "@/components/ui/status-chip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { Agent, ComposioConnection, ComposioTool, ComposioToolkit } from "@/types";

export default function VoiceAgentsIntegrationsPage() {
  const { orgId } = requireScope();
  const [tab, setTab] = useState<"browse" | "connected">("browse");
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [manageToolkit, setManageToolkit] = useState<ComposioToolkit | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.listComposioToolkits(orgId, { }).then((p) => setToolkits(p.items)),
      api.listComposioConnections(orgId).then(setConnections),
    ]).finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    document.title = "Integrations · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filteredToolkits = toolkits.filter((t) => !q || t.name.toLowerCase().includes(q) || t.slug.includes(q));
  const activeConnections = connections.filter((c) => c.status === "active");

  async function connect(toolkit: ComposioToolkit) {
    setConnecting(toolkit.slug);
    try {
      const callbackUrl = `${window.location.origin}/integrations`;
      const { connection, redirect_url } = await api.connectComposioToolkit(orgId, toolkit.slug, callbackUrl);
      if (redirect_url) {
        window.open(redirect_url, "_blank", "noopener,noreferrer");
        toast.message(`Finish connecting ${toolkit.name} in the new tab, then come back here`);
        // Give the OAuth flow a moment, then poll once for a quick status flip.
        setTimeout(() => {
          void api.refreshComposioConnection(connection.id).then(() => refresh());
        }, 4000);
      } else {
        toast.message(`${toolkit.name} connected`);
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the connection");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(connection: ComposioConnection) {
    try {
      await api.disconnectComposio(connection.id);
      toast.message(`${connection.toolkit_name || connection.toolkit_slug} disconnected`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect");
    }
  }

  return (
    <div className="voice-page voice-page-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-display flex items-center gap-2">
            <KupeIcon name="plug" className="size-6" />
            Integrations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect apps your agent can act in — Gmail, Slack, Calendar, CRMs — powered by Composio.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search apps" className="h-9 w-56 rounded-full pl-8" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="browse">Browse apps</TabsTrigger>
          <TabsTrigger value="connected">
            Connected
            {activeConnections.length > 0 && <Badge variant="secondary" className="ml-1.5">{activeConnections.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          {loading ? (
            <VoiceTableShimmer rows={4} />
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredToolkits.map((tk) => (
                <div key={tk.slug} className="flex items-start gap-3 rounded-xl border border-border p-4">
                  <img src={tk.logo} alt={tk.name} className="size-10 shrink-0 rounded-lg bg-white object-contain p-1 ring-1 ring-border" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{tk.name}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{tk.description}</p>
                    <div className="mt-2">
                      {tk.connected ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setManageToolkit(tk)}>
                          <Check className="size-3.5 text-emerald-600" />
                          Manage tools
                        </Button>
                      ) : (
                        <Button size="sm" className="rounded-full" disabled={connecting === tk.slug} onClick={() => void connect(tk)}>
                          {connecting === tk.slug ? "Connecting…" : "Connect"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredToolkits.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No apps match “{search}”.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connected">
          {connections.length === 0 ? (
            <AsciiEmptyState
              kind="folder"
              tone="coral"
              title="No apps connected yet"
              description="Connect an app from the Browse tab to let your agent take real actions in it."
              className="mt-4 min-h-[240px]"
            />
          ) : (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {connections.map((c) => {
                const toolkit = toolkits.find((t) => t.slug === c.toolkit_slug);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {toolkit ? (
                        <img src={toolkit.logo} alt={c.toolkit_name} className="size-8 rounded-md bg-white object-contain p-1 ring-1 ring-border" />
                      ) : (
                        <Plug className="size-8 rounded-md bg-muted p-1.5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-semibold">{c.toolkit_name || c.toolkit_slug}</p>
                        <StatusChip status={c.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "active" && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => toolkit && setManageToolkit(toolkit)}>
                          Manage tools
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => void disconnect(c)}>
                        <Unplug className="size-3.5" />
                        Disconnect
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {manageToolkit && (
        <ManageToolsDialog
          toolkit={manageToolkit}
          connection={connections.find((c) => c.toolkit_slug === manageToolkit.slug && c.status === "active") ?? null}
          orgId={orgId}
          open={!!manageToolkit}
          onOpenChange={(open) => !open && setManageToolkit(null)}
        />
      )}
    </div>
  );
}

function ManageToolsDialog({
  toolkit,
  connection,
  orgId,
  open,
  onOpenChange,
}: {
  toolkit: ComposioToolkit;
  connection: ComposioConnection | null;
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tools, setTools] = useState<ComposioTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [pickAgentFor, setPickAgentFor] = useState<ComposioTool | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const { projectId } = requireScope();
    Promise.allSettled([
      api.listComposioToolkitTools(orgId, toolkit.slug).then((p) => setTools(p.items)),
      api.listAgents(orgId, projectId, { limit: 100 }).then((p) => setAgents(p.items)),
    ]).finally(() => setLoading(false));
  }, [open, orgId, toolkit.slug]);

  async function attachAndPickAgent(tool: ComposioTool, agentId: string) {
    if (!connection) return;
    setAttaching(tool.slug);
    try {
      const created = await api.attachComposioTool(orgId, {
        toolkit_slug: toolkit.slug,
        tool_slug: tool.slug,
        connection_id: connection.id,
        name: tool.slug.toLowerCase(),
        label: tool.name,
      });
      await api.attachAgentTool(agentId, created.id, true);
      toast.message(`${tool.name} added to your agent`);
      setPickAgentFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add this tool");
    } finally {
      setAttaching(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{toolkit.name} tools</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <img src={toolkit.logo} alt={toolkit.name} className="size-6 rounded bg-white object-contain p-0.5 ring-1 ring-border" />
          <h2 className="text-base font-semibold tracking-tight">{toolkit.name} actions</h2>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {!connection ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Connect {toolkit.name} first.</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tools.map((t) => (
                <li key={t.slug} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 rounded-full"
                      disabled={attaching === t.slug}
                      onClick={() => setPickAgentFor(t)}
                    >
                      Add to agent
                    </Button>
                  </div>
                  {pickAgentFor?.slug === t.slug && (
                    <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg bg-muted/40 p-2">
                      {agents.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No agents yet — create one first.</span>
                      ) : (
                        agents.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="pressable rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                            disabled={attaching === t.slug}
                            onClick={() => void attachAndPickAgent(t, a.id)}
                          >
                            {a.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>{tools.length} actions available</span>
          <a href={`https://composio.dev/toolkits/${toolkit.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            View on Composio <ExternalLink className="size-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
