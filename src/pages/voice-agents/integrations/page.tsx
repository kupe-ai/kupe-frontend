"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Loader2, Plug, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import {
  parameterHintForMethod,
  paramRowsToSchema,
  schemaToParamRows,
  ToolParametersEditor,
  type ToolParamRow,
} from "@/components/voice-agents/tool-parameters-editor";
import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { Agent, CatalogTool, ComposioConnection, ComposioTool, ComposioToolkit } from "@/types";

type AddMode = "custom" | "mcp" | null;

export default function VoiceAgentsIntegrationsPage() {
  const { orgId } = requireScope();
  const [tab, setTab] = useState<"browse" | "connected">("browse");
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [catalogTools, setCatalogTools] = useState<CatalogTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [manageToolkit, setManageToolkit] = useState<ComposioToolkit | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [editingTool, setEditingTool] = useState<CatalogTool | null>(null);
  const autoTabbed = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.listComposioToolkits(orgId, { search: debouncedSearch || undefined }).then((p) => setToolkits(p.items)),
      api.listComposioConnections(orgId).then(setConnections),
      api.listTools(orgId, { limit: 100 }).then((p) => setCatalogTools(p.items)),
    ]).finally(() => setLoading(false));
  }, [orgId, debouncedSearch]);

  useEffect(() => {
    document.title = "Integrations · Voice Agents · Kupe";
    refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filteredToolkits = toolkits;
  const customTools = catalogTools.filter((t) => t.kind === "custom_webhook");
  const mcpTools = catalogTools.filter((t) => t.kind === "mcp" && !t.composio_toolkit_slug);
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

  useEffect(() => {
    if (loading) return;
    if (!autoTabbed.current) {
      autoTabbed.current = true;
      setTab(rowCount > 0 ? "connected" : "browse");
      return;
    }
    if (rowCount === 0) setTab("browse");
  }, [loading, rowCount]);

  function openAdd(mode: AddMode) {
    setEditingTool(null);
    setAddMode(mode);
  }

  function openEdit(tool: CatalogTool) {
    setEditingTool(tool);
    setAddMode(tool.kind === "mcp" ? "mcp" : "custom");
  }

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
          <h1 className="text-title flex items-center gap-2">Integrations</h1>
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
              <DropdownMenuItem onClick={() => setTab("browse")}>Plugin</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("custom")}>Custom API / Webhook</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAdd("mcp")}>MCP server</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs
        value={rowCount === 0 ? "browse" : tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="mt-6"
      >
        <TabsList>
          {rowCount > 0 && (
            <TabsTrigger value="connected">
              Connected
              <Badge variant="secondary" className="ml-1.5">{rowCount}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="browse">Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="connected">
          {loading ? (
            <VoiceTableShimmer rows={4} />
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
                        <TableCell className="text-muted-foreground">Plugin</TableCell>
                        <TableCell><StatusChip status={c.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {c.status === "active" && (
                              <Button size="sm" variant="outline" className="rounded-full" onClick={() => toolkit && setManageToolkit(toolkit)}>
                                Choose actions
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
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(t)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => void deleteCatalogTool(t)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No connections match “{search}”.
                    </TableCell>
                  </TableRow>
                )}
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
                          Choose actions
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
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No plugins match “{search}”.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {manageToolkit && (
        <ManageToolsDialog
          toolkit={manageToolkit}
          connection={connections.find((c) => c.toolkit_slug === manageToolkit.slug && c.status === "active") ?? null}
          catalogTool={
            catalogTools.find((t) => t.composio_toolkit_slug === manageToolkit.slug && !t.composio_tool_slug) ?? null
          }
          orgId={orgId}
          open={!!manageToolkit}
          onOpenChange={(open) => !open && setManageToolkit(null)}
          onSaved={refresh}
        />
      )}

      <AddCustomToolDialog
        open={addMode === "custom"}
        onOpenChange={(open) => {
          if (!open) {
            setAddMode(null);
            setEditingTool(null);
          }
        }}
        orgId={orgId}
        tool={addMode === "custom" ? editingTool : null}
        onCreated={() => {
          setAddMode(null);
          setEditingTool(null);
          setTab("connected");
          refresh();
        }}
      />
      <AddMcpToolDialog
        open={addMode === "mcp"}
        onOpenChange={(open) => {
          if (!open) {
            setAddMode(null);
            setEditingTool(null);
          }
        }}
        orgId={orgId}
        tool={addMode === "mcp" ? editingTool : null}
        onCreated={() => {
          setAddMode(null);
          setEditingTool(null);
          setTab("connected");
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
  tool,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  tool: CatalogTool | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<ToolParamRow[]>([]);
  const [saving, setSaving] = useState(false);
  const editing = !!tool;

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setMethod("POST");
      setUrl("");
      setParams([]);
      return;
    }
    if (tool) {
      setName(tool.name);
      setDescription(tool.description ?? "");
      setMethod((tool.http_method || "POST").toUpperCase());
      setUrl(tool.http_url ?? "");
      setParams(schemaToParamRows(tool.parameters, tool.required));
    }
  }, [open, tool]);

  async function save() {
    if (!name.trim() || !url.trim()) {
      toast.message("Name and URL are required");
      return;
    }
    const { parameters, required } = paramRowsToSchema(params);
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        http_url: url.trim(),
        http_method: method,
        kind: "custom_webhook" as const,
        parameters,
        required,
      };
      if (tool) {
        await api.updateTool(tool.id, body);
        toast.message(`${name} updated`);
      } else {
        await api.createTool(orgId, body);
        toast.message(`${name} added`);
      }
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save this tool");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Custom API / Webhook" : "Add Custom API / Webhook"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="check_availability" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this tool does — the LLM reads this"
            />
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
          <ToolParametersEditor rows={params} onChange={setParams} hint={parameterHintForMethod(method)} />
          <p className="text-xs text-muted-foreground">
            Once saved, attach this tool to an agent from the agent editor's Tools tab.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} loading={saving}>
            {editing ? "Save" : "Add tool"}
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
  tool,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  tool: CatalogTool | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [remoteToolName, setRemoteToolName] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [params, setParams] = useState<ToolParamRow[]>([]);
  const [saving, setSaving] = useState(false);
  const editing = !!tool;

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setServerUrl("");
      setRemoteToolName("");
      setAuthHeader("");
      setParams([]);
      return;
    }
    if (tool) {
      setName(tool.name);
      setDescription(tool.description ?? "");
      setServerUrl(tool.http_url ?? "");
      setRemoteToolName(tool.mcp_tool_name ?? "");
      setParams(schemaToParamRows(tool.parameters, tool.required));
    }
  }, [open, tool]);

  async function save() {
    if (!name.trim() || !serverUrl.trim() || !remoteToolName.trim()) {
      toast.message("Name, MCP server URL, and remote tool name are required");
      return;
    }
    let headers: Record<string, string> | undefined;
    if (authHeader.trim()) {
      const idx = authHeader.indexOf(":");
      if (idx === -1) {
        toast.message('Auth header must be "Header-Name: value"');
        return;
      }
      headers = { [authHeader.slice(0, idx).trim()]: authHeader.slice(idx + 1).trim() };
    }
    const { parameters, required } = paramRowsToSchema(params);
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        http_url: serverUrl.trim(),
        kind: "mcp" as const,
        mcp_tool_name: remoteToolName.trim(),
        parameters,
        required,
        ...(headers ? { http_headers: headers } : {}),
      };
      if (tool) {
        await api.updateTool(tool.id, body);
        toast.message(`${name} updated`);
      } else {
        await api.createTool(orgId, body);
        toast.message(`${name} added`);
      }
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save this MCP tool");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit MCP server tool" : "Add MCP server tool"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="How the agent refers to this tool" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this tool does — the LLM reads this"
            />
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
          <ToolParametersEditor
            rows={params}
            onChange={setParams}
            hint="Sent as arguments to the remote MCP tool. The LLM fills these from the conversation."
          />
          <p className="text-xs text-muted-foreground">
            Supports MCP servers reachable over plain HTTP JSON-RPC (no live discovery yet — enter the exact remote tool name).
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} loading={saving}>
            {editing ? "Save" : "Add tool"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageToolsDialog({
  toolkit,
  connection,
  catalogTool,
  orgId,
  open,
  onOpenChange,
  onSaved,
}: {
  toolkit: ComposioToolkit;
  connection: ComposioConnection | null;
  catalogTool: CatalogTool | null;
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [tools, setTools] = useState<ComposioTool[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showingAll, setShowingAll] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [pickAgent, setPickAgent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPickAgent(false);
    setShowingAll(false);
    const { projectId } = requireScope();
    Promise.allSettled([
      api.listComposioToolkitTools(orgId, toolkit.slug, { important: true }).then((p) => {
        setTools(p.items);
        const saved = catalogTool?.composio_allowed_tool_slugs?.filter(Boolean) ?? [];
        setSelected(new Set(saved.length ? saved : p.items.map((t) => t.slug)));
      }),
      api.listAgents(orgId, projectId, { limit: 100 }).then((p) => setAgents(p.items)),
    ]).finally(() => setLoading(false));
  }, [open, orgId, toolkit.slug, catalogTool?.id]);

  async function loadAll() {
    setShowingAll(true);
    const page = await api.listComposioToolkitTools(orgId, toolkit.slug);
    setTools(page.items);
  }

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function save(agentId?: string) {
    if (!connection) return;
    const tool_slugs = [...selected];
    if (tool_slugs.length === 0) {
      toast.message("Pick at least one action");
      return;
    }
    setAttaching(true);
    try {
      await api.attachComposioTool(orgId, {
        toolkit_slug: toolkit.slug,
        connection_id: connection.id,
        tool_slugs,
        agent_id: agentId,
      });
      toast.message(
        agentId
          ? `${toolkit.name} added to your agent (${tool_slugs.length} actions)`
          : `${toolkit.name} saved (${tool_slugs.length} actions)`,
      );
      setPickAgent(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save these actions");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{toolkit.name} actions</DialogTitle>
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
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Voice agents only see the actions you pick. Featured actions are selected by default —
                keep that set small.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="rounded-full" disabled={attaching} onClick={() => void save()}>
                  {attaching ? "Saving…" : "Save actions"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={attaching}
                  onClick={() => setPickAgent((openPicker) => !openPicker)}
                >
                  Save and add to agent
                </Button>
                {!showingAll && (
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void loadAll()}>
                    Show all actions
                  </Button>
                )}
              </div>
              {pickAgent && (
                <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted/40 p-2">
                  {agents.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No agents yet — create one first.</span>
                  ) : (
                    agents.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="pressable rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                        disabled={attaching}
                        onClick={() => void save(a.id)}
                      >
                        {a.name}
                      </button>
                    ))
                  )}
                </div>
              )}
              <ul className="divide-y divide-border">
                {tools.map((t) => (
                  <li key={t.slug} className="flex items-start gap-3 py-3">
                    <Checkbox
                      checked={selected.has(t.slug)}
                      onCheckedChange={() => toggle(t.slug)}
                      className="mt-0.5"
                      aria-label={t.name}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            {selected.size} selected
            {showingAll ? ` · ${tools.length} listed` : " · featured"}
          </span>
          <a href={`https://composio.dev/toolkits/${toolkit.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            View on Composio <ExternalLink className="size-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
