"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Download, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import {
  attachCallDatabaseAgent,
  detachCallDatabaseAgent,
  exportCallDatabase,
  getCallDatabase,
  listCallDatabaseAgents,
  listCallDatabaseRows,
  patchCallDatabase,
  type AnalysisField,
  type CallDatabase,
  type CallDatabaseAgent,
  type CallDatabaseRow,
  type DatabaseDestination,
} from "@/lib/api/voice/databases";
import type { Agent, CatalogTool, ComposioConnection } from "@/types";
import { cn } from "@/lib/utils";

const SYSTEM_COLS = [
  { key: "who_called", label: "Who called" },
  { key: "started_at", label: "Started" },
  { key: "duration_seconds", label: "Duration" },
] as const;

const BUILTIN_COLS = [
  { key: "summary", label: "Summary" },
  { key: "success", label: "Success" },
] as const;

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function cellValue(row: CallDatabaseRow, key: string) {
  if (key === "who_called") return row.who_called || "—";
  if (key === "started_at") return formatWhen(row.started_at);
  if (key === "duration_seconds") return formatDuration(row.duration_seconds);
  const v = row.values?.[key];
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default function VoiceAgentsDatabaseDetailPage() {
  const { id = "" } = useParams();
  const [db, setDb] = useState<CallDatabase | null>(null);
  const [rows, setRows] = useState<CallDatabaseRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedQ(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadRows = useCallback(
    async (cursor?: string) => {
      if (!id) return;
      const page = await listCallDatabaseRows(id, { cursor, limit: 50, q: appliedQ || undefined });
      setRows((prev) => (cursor ? [...prev, ...page.items] : page.items));
      setNextCursor(page.next_cursor);
      setTotal(page.total);
    },
    [id, appliedQ],
  );

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [meta] = await Promise.all([getCallDatabase(id), loadRows()]);
      setDb(meta);
    } catch {
      toast.error("Couldn't load database");
      setDb(null);
    } finally {
      setLoading(false);
    }
  }, [id, loadRows]);

  useEffect(() => {
    document.title = db ? `${db.name} · Databases · Kupe` : "Database · Kupe";
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const columns = useMemo(() => {
    const custom = (db?.fields || []).filter((f) => f.name !== "summary" && f.name !== "success");
    return [...SYSTEM_COLS, ...BUILTIN_COLS, ...custom.map((f) => ({ key: f.name, label: f.name }))];
  }, [db]);

  if (loading && !db) {
    return (
      <div className="flex h-full min-h-0 flex-col p-6">
        <VoiceTableShimmer />
      </div>
    );
  }

  if (!db) {
    return (
      <div className="p-6">
        <Link to="/databases" className="text-sm text-muted-foreground hover:text-foreground">
          ← Databases
        </Link>
        <p className="mt-4">Database not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          to="/databases"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Databases
        </Link>
        <h1 className="min-w-0 truncate text-lg font-semibold">{db.name}</h1>
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rows"
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <Download className="size-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["csv", "json", "ndjson", "zip"] as const).map((fmt) => (
              <DropdownMenuItem
                key={fmt}
                onClick={() =>
                  exportCallDatabase(db.id, fmt, q || undefined).catch(() => toast.error("Export failed"))
                }
              >
                {fmt.toUpperCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" className="rounded-full" onClick={() => setSchemaOpen(true)}>
          Schema
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground",
                    i < 3 && "sticky bg-muted/50",
                    i === 0 && "left-0 z-20",
                    i === 1 && "left-[9rem] z-10",
                    i === 2 && "left-[18rem] z-10",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/40">
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(
                      "max-w-xs truncate px-3 py-2",
                      i < 3 && "sticky bg-background",
                      i === 0 && "left-0 z-10",
                      i === 1 && "left-[9rem]",
                      i === 2 && "left-[18rem]",
                    )}
                    title={cellValue(row, col.key)}
                  >
                    {cellValue(row, col.key)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-3 py-10 text-muted-foreground" colSpan={columns.length}>
                  No rows yet. They appear here after calls finish.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
        <span>
          {rows.length} of {total}
        </span>
        {nextCursor ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              try {
                await loadRows(nextCursor);
              } finally {
                setLoadingMore(false);
              }
            }}
          >
            Load more
          </Button>
        ) : null}
      </div>

      <SchemaSheet
        open={schemaOpen}
        onOpenChange={setSchemaOpen}
        db={db}
        onSaved={(next) => setDb(next)}
      />
    </div>
  );
}

function SchemaSheet({
  open,
  onOpenChange,
  db,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: CallDatabase;
  onSaved: (db: CallDatabase) => void;
}) {
  const [fields, setFields] = useState<AnalysisField[]>(db.fields);
  const [destinations, setDestinations] = useState<DatabaseDestination[]>(db.destinations || []);
  const [agents, setAgents] = useState<CallDatabaseAgent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFields(db.fields);
    setDestinations(db.destinations || []);
    const { orgId, projectId } = requireScope();
    void Promise.all([
      listCallDatabaseAgents(db.id).then(setAgents),
      api.listAgents(orgId, projectId, { limit: 100 }).then((p) => setAllAgents(p.items)),
      api.listTools(orgId, { limit: 100 }).then((p) => setTools(p.items)),
      api.listComposioConnections(orgId).then(setConnections).catch(() => setConnections([])),
    ]);
  }, [open, db]);

  async function save() {
    setSaving(true);
    try {
      const cleaned = fields.filter((f) => f.name.trim());
      const next = await patchCallDatabase(db.id, { fields: cleaned, destinations });
      onSaved(next);
      toast.message("Schema saved");
    } catch {
      toast.error("Couldn't save schema");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetTitle>Schema</SheetTitle>
        <Tabs defaultValue="columns" className="mt-4">
          <TabsList>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="destinations">Destinations</TabsTrigger>
          </TabsList>
          <TabsContent value="columns" className="mt-4 space-y-3">
            {fields.map((field, idx) => (
              <div key={`${field.name}-${idx}`} className="grid grid-cols-[1fr_7rem_1fr_auto] items-center gap-2">
                <Input
                  value={field.name}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...field, name: e.target.value };
                    setFields(next);
                  }}
                  placeholder="name"
                />
                <Select
                  value={field.type}
                  onValueChange={(type) => {
                    const next = [...fields];
                    next[idx] = { ...field, type: type as AnalysisField["type"] };
                    setFields(next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                    <SelectItem value="enum">enum</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={field.description}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...field, description: e.target.value };
                    setFields(next);
                  }}
                  placeholder="description"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFields([...fields, { name: "", type: "string", description: "" }])}
            >
              <Plus className="size-4" />
              Add column
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              Save columns
            </Button>
          </TabsContent>
          <TabsContent value="agents" className="mt-4 space-y-3">
            {agents.map((link) => (
              <div key={link.agent_id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>{link.name || link.agent_id}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await detachCallDatabaseAgent(db.id, link.agent_id);
                      setAgents(agents.filter((a) => a.agent_id !== link.agent_id));
                    } catch {
                      toast.error("Couldn't detach");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Select
              onValueChange={async (agentId) => {
                try {
                  const attached = await attachCallDatabaseAgent(db.id, agentId);
                  const named = allAgents.find((a) => a.id === agentId);
                  setAgents([...agents, { ...attached, name: named?.name }]);
                } catch {
                  toast.error("Couldn't attach agent");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Attach an agent" />
              </SelectTrigger>
              <SelectContent>
                {allAgents
                  .filter((a) => !agents.some((l) => l.agent_id === a.id))
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </TabsContent>
          <TabsContent value="destinations" className="mt-4 space-y-4">
            {destinations.map((dest, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{dest.kind}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDestinations(destinations.filter((_, i) => i !== idx))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {dest.kind === "webhook" && (
                  <Input
                    value={dest.url || ""}
                    placeholder="https://…"
                    onChange={(e) => {
                      const next = [...destinations];
                      next[idx] = { ...dest, url: e.target.value };
                      setDestinations(next);
                    }}
                  />
                )}
                {dest.kind === "tool" && (
                  <Select
                    value={dest.tool_id || ""}
                    onValueChange={(toolId) => {
                      const next = [...destinations];
                      next[idx] = { ...dest, tool_id: toolId };
                      setDestinations(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a tool" />
                    </SelectTrigger>
                    <SelectContent>
                      {tools.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {dest.kind === "composio" && (
                  <div className="grid gap-2">
                    <Input
                      value={dest.composio_slug || ""}
                      placeholder="Tool slug"
                      onChange={(e) => {
                        const next = [...destinations];
                        next[idx] = { ...dest, composio_slug: e.target.value };
                        setDestinations(next);
                      }}
                    />
                    <Select
                      value={dest.connected_account_id || ""}
                      onValueChange={(cid) => {
                        const next = [...destinations];
                        next[idx] = { ...dest, connected_account_id: cid };
                        setDestinations(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Connected account" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.toolkit_name || c.toolkit_slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDestinations([...destinations, { kind: "webhook", url: "" }])}
              >
                Add webhook
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDestinations([...destinations, { kind: "tool" }])}
              >
                Add tool
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDestinations([...destinations, { kind: "composio" }])}
              >
                Add Composio
              </Button>
            </div>
            <Button onClick={() => void save()} disabled={saving}>
              Save destinations
            </Button>
            <p className="text-xs text-muted-foreground">
              Destinations fire after a row is written. Webhooks must be public HTTPS URLs.
            </p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
