"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ExternalLink, Loader2, Plug, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusChip } from "@/components/ui/status-chip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { Agent, CatalogTool, ComposioConnection, ComposioTool, ComposioToolkit } from "@/types";

type AddMode = "custom" | "mcp" | null;

export default function VoiceAgentsIntegrationsPage() {
  const { orgId } = requireScope();
  const [tab, setTab] = useState<"browse" | "connected">("connected");
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [catalogTools, setCatalogTools] = useState<CatalogTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [manageToolkit, setManageToolkit] = useState<ComposioToolkit | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.listComposioToolkits(orgId, {}).then((p) => setToolkits(p.items)),
      api.listComposioConnections(orgId).then(setConnections),
      api.listTools(orgId, { limit: 100 }).then((p) => setCatalogTools(p.items)),
    ]).finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    document.title = "Integrations · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filteredToolkits = toolkits.filter((t) => !q || t.name.toLowerCase().includes(q) || t.slug.includes(q));
  const customTools = catalogTools.filter((t) => t.kind === "custom_webhook");
  const mcpTools = catalogTools.filter((t) => t.kind === "mcp");
  const rowCount = connections.length + customTools.length + mcpTools.length;
  const filteredRows = useMemo(() => {
    type Row =
      | { type: "composio"; connection: ComposioConnection }
      | { type: "custom" | "mcp"; tool: CatalogTool };
    const rows: Row[] = [
      ...connections.map((connection) => ({ type: "composio" as const, connection })),
      ...customTools.map((tool) => ({ type: "custom" as const, tool })),
      ...mcpTools.map((tool) => ({ type: "mcp" as const, tool })),
    ];
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.type === "composio" ? r.connection.toolkit_name || r.connection.toolkit_slug : r.tool.name;
      return name.toLowerCase().includes(q);
    });
  }, [connections, customTools, mcpTools, q]);

  async function connect(toolkit: ComposioToolkit) {
    setConnecting(toolkit.slug);
    try {
      // A dedicated callback page (not the full /integrations page) so the
      // OAuth popup can announce completion and close itself instead of
      // reloading the whole app into a second, orphaned tab.
      const callbackUrl = `${window.location.origin}/integrations/callback`;
      const { connection, redirect_url } = await api.connectComposioToolkit(orgId, toolkit.slug, callbackUrl);
      if (redirect_url) {
        const popup = window.open(
          redirect_url,
          "kupe-composio-oauth",
          "width=520,height=680,noopener=no,noreferrer=no",
        );
        toast.message(`Finish connecting ${toolkit.name} in the popup window`);

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener("message", onMessage);
          window.clearInterval(closedPoll);
          void api.refreshComposioConnection(connection.id).finally(() => refresh());
        };
        const onMessage = (e: MessageEvent) => {
          if (e.origin !== window.location.origin) return;
          if (e.data?.source === "kupe-composio-callback") finish();
        };
        window.addEventListener("message", onMessage);
        // Fallback for browsers that block postMessage/close from the popup,
        // or if the user closes it manually: notice it went away and refresh.
        const closedPoll = window.setInterval(() => {
          if (!popup || popup.closed) finish();
        }, 1000);
        // Safety net in case the user leaves the popup open indefinitely.
        window.setTimeout(finish, 5 * 60 * 1000);
      } else {
        toast.message(`${toolkit.name} connected`);
      }
      refresh();
      setTab("connected");
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

  async function deleteCatalogTool(tool: CatalogTool) {
    try {
      await api.archiveTool(tool.id);
      toast.message(`${tool.name} removed`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this tool");
    }
  }

  return (
    <div className="voice-page voice-page-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-display flex items-center gap-2">Integrations</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-9 w-52 rounded-full pl-8" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="rounded-full">
                Add <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTab("browse")}>Browse Composio apps</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddMode("custom")}>Custom API / Webhook</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddMode("mcp")}>MCP server</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="connected">
            Connected
            {rowCount > 0 && <Badge variant="secondary" className="ml-1.5">{rowCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="browse">Browse Composio apps</TabsTrigger>
        </TabsList>

        <TabsContent value="connected">
          {loading ? (
            <VoiceTableShimmer rows={4} />
          ) : filteredRows.length === 0 ? (
            <AsciiEmptyState
              kind="folder"
              tone="coral"
              title="Nothing connected yet"
              description="Connect a Composio app, or add a Custom API, webhook, or MCP server from the Add menu above."
              className="mt-4 min-h-[240px]"
            />
          ) : (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  if (row.type === "composio") {
                    const c = row.connection;
                    const toolkit = toolkits.find((t) => t.slug === c.toolkit_slug);
                    return (
                      <TableRow key={`composio-${c.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {toolkit ? (
                              <img src={toolkit.logo} alt={c.toolkit_name} className="size-6 rounded bg-white object-contain p-0.5 ring-1 ring-border" />
                            ) : (
                              <Plug className="size-6 rounded bg-muted p-1 text-muted-foreground" />
                            )}
                            <span className="font-medium">{c.toolkit_name || c.toolkit_slug}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">Composio app</TableCell>
                        <TableCell><StatusChip status={c.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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
                        </TableCell>
                      </TableRow>
                    );
                  }
                  const t = row.tool;
                  return (
                    <TableRow key={`${row.type}-${t.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-400">
                            {row.type === "mcp" ? "M" : "⛓"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.type === "mcp" ? "MCP tool" : "Custom API / Webhook"}</TableCell>
                      <TableCell><StatusChip status="active" /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => void deleteCatalogTool(t)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

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

      <AddCustomToolDialog
        open={addMode === "custom"}
        onOpenChange={(open) => setAddMode(open ? "custom" : null)}
        orgId={orgId}
        onCreated={() => {
          setAddMode(null);
          refresh();
        }}
      />
      <AddMcpToolDialog
        open={addMode === "mcp"}
        onOpenChange={(open) => setAddMode(open ? "mcp" : null)}
        orgId={orgId}
        onCreated={() => {
          setAddMode(null);
          refresh();
        }}
      />
    </div>
  );
}

function AddCustomToolDialog({
  open,
  onOpenChange,
  orgId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setMethod("POST");
      setUrl("");
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !url.trim()) {
      toast.message("Name and URL are required");
      return;
    }
    setSaving(true);
    try {
      await api.createTool(orgId, {
        name: name.trim(),
        description: description.trim(),
        http_url: url.trim(),
        http_method: method,
        kind: "custom_webhook",
      });
      toast.message(`${name} added`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add this tool");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom API / Webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="check_availability" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this tool does — the LLM reads this" />
          </div>
          <div className="flex gap-2">
            <div className="w-28 space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Once added, attach this tool to an agent from the agent editor's Tools tab.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} loading={saving}>
            Add tool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMcpToolDialog({
  open,
  onOpenChange,
  orgId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [remoteToolName, setRemoteToolName] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setServerUrl("");
      setRemoteToolName("");
      setAuthHeader("");
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !serverUrl.trim() || !remoteToolName.trim()) {
      toast.message("Name, MCP server URL, and remote tool name are required");
      return;
    }
    let headers: Record<string, string> = {};
    if (authHeader.trim()) {
      const idx = authHeader.indexOf(":");
      if (idx === -1) {
        toast.message('Auth header must be "Header-Name: value"');
        return;
      }
      headers = { [authHeader.slice(0, idx).trim()]: authHeader.slice(idx + 1).trim() };
    }
    setSaving(true);
    try {
      await api.createTool(orgId, {
        name: name.trim(),
        description: description.trim(),
        http_url: serverUrl.trim(),
        kind: "mcp",
        mcp_tool_name: remoteToolName.trim(),
        http_headers: headers,
      });
      toast.message(`${name} added`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add this MCP tool");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP server tool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="How the agent refers to this tool" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this tool does — the LLM reads this" />
          </div>
          <div className="space-y-1.5">
            <Label>MCP server URL</Label>
            <Input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://your-mcp-server.example.com/mcp" />
          </div>
          <div className="space-y-1.5">
            <Label>Remote tool name</Label>
            <Input value={remoteToolName} onChange={(e) => setRemoteToolName(e.target.value)} placeholder="Exact tool name on that server" />
          </div>
          <div className="space-y-1.5">
            <Label>Auth header (optional)</Label>
            <Input value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} placeholder="Authorization: Bearer sk-…" />
          </div>
          <p className="text-xs text-muted-foreground">
            Supports MCP servers reachable over plain HTTP JSON-RPC (no live discovery yet — enter the exact remote tool name).
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} loading={saving}>
            Add tool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
