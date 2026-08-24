"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Filter,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTableShimmer } from "@/components/ui/shimmer";
import { QuickContextMenu, type QuickMenuEntry } from "@/components/quick-context-menu";
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
  { key: "who_called", label: "Who called", schema: false },
  { key: "started_at", label: "Started", schema: false },
  { key: "duration_seconds", label: "Duration", schema: false },
] as const;

const BUILTIN_COLS = [
  { key: "summary", label: "Summary", schema: true },
  { key: "success", label: "Success", schema: true },
] as const;

type ColDef = { key: string; label: string; schema: boolean };
type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

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

function rawValue(row: CallDatabaseRow, key: string): unknown {
  if (key === "who_called") return row.who_called;
  if (key === "started_at") return row.started_at;
  if (key === "duration_seconds") return row.duration_seconds;
  return row.values?.[key];
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

function compareRows(a: CallDatabaseRow, b: CallDatabaseRow, key: string, dir: SortDir) {
  const av = rawValue(a, key);
  const bv = rawValue(b, key);
  let cmp = 0;
  if (av == null && bv == null) cmp = 0;
  else if (av == null) cmp = 1;
  else if (bv == null) cmp = -1;
  else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else if (typeof av === "boolean" && typeof bv === "boolean") cmp = Number(av) - Number(bv);
  else if (key === "started_at") {
    cmp = new Date(String(av)).getTime() - new Date(String(bv)).getTime();
  } else {
    cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  }
  return dir === "asc" ? cmp : -cmp;
}

export default function VoiceAgentsDatabaseDetailPage() {
  const { id = "" } = useParams();
  const [db, setDb] = useState<CallDatabase | null>(null);
  const [rows, setRows] = useState<CallDatabaseRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [schemaTab, setSchemaTab] = useState("columns");
  const [focusField, setFocusField] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(50);
  const [sort, setSort] = useState<SortState>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => new Set());
  const [successFilter, setSuccessFilter] = useState<"all" | "yes" | "no">("all");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedQ(q.trim()), 500);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadRows = useCallback(
    async (cursor: string | null, replaceStack = false) => {
      if (!id) return;
      setRowsLoading(true);
      try {
        const page = await listCallDatabaseRows(id, {
          cursor: cursor ?? undefined,
          limit: perPage,
          q: appliedQ || undefined,
        });
        setRows(page.items);
        setNextCursor(page.next_cursor);
        setTotal(page.total);
        if (replaceStack) setCursorStack([null]);
      } catch {
        toast.error("Couldn't load rows");
        setRows([]);
      } finally {
        setRowsLoading(false);
      }
    },
    [id, appliedQ, perPage],
  );

  useEffect(() => {
    document.title = db ? `${db.name} · Databases · Kupe` : "Database · Kupe";
  }, [db]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    void getCallDatabase(id)
      .then((meta) => {
        if (!cancelled) setDb(meta);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Couldn't load database");
          setDb(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !db) return;
    void loadRows(null, true);
  }, [id, db?.id, appliedQ, perPage, loadRows]);
  const allColumns: ColDef[] = useMemo(() => {
    const custom = (db?.fields || [])
      .filter((f) => f.name !== "summary" && f.name !== "success")
      .map((f) => ({ key: f.name, label: f.name, schema: true }));
    return [...SYSTEM_COLS, ...BUILTIN_COLS, ...custom];
  }, [db]);

  const columns = useMemo(
    () => allColumns.filter((c) => !hiddenCols.has(c.key)),
    [allColumns, hiddenCols],
  );

  const displayRows = useMemo(() => {
    let list = rows;
    if (successFilter !== "all") {
      list = list.filter((row) => {
        const v = row.values?.success;
        const yes = v === true || v === "true" || v === "Yes" || v === "yes";
        return successFilter === "yes" ? yes : !yes;
      });
    }
    const activeFilters = Object.entries(colFilters).filter(([, v]) => v.trim());
    if (activeFilters.length) {
      list = list.filter((row) =>
        activeFilters.every(([key, needle]) =>
          cellValue(row, key).toLowerCase().includes(needle.trim().toLowerCase()),
        ),
      );
    }
    if (sort) {
      list = [...list].sort((a, b) => compareRows(a, b, sort.key, sort.dir));
    }
    return list;
  }, [rows, successFilter, colFilters, sort]);

  const pageIndex = cursorStack.length;
  const canPrev = cursorStack.length > 1;
  const canNext = Boolean(nextCursor);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function openSchema(opts?: { field?: string; tab?: string }) {
    setFocusField(opts?.field ?? null);
    setSchemaTab(opts?.tab ?? "columns");
    setSchemaOpen(true);
  }

  async function patchField(name: string, patch: Partial<AnalysisField> | "delete") {
    if (!db) return;
    try {
      let nextFields: AnalysisField[];
      if (patch === "delete") {
        nextFields = db.fields.filter((f) => f.name !== name);
      } else {
        const idx = db.fields.findIndex((f) => f.name === name);
        if (idx < 0) {
          nextFields = [...db.fields, { name, type: "string", description: "", ...patch }];
        } else {
          nextFields = db.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
        }
      }
      const next = await patchCallDatabase(db.id, { fields: nextFields });
      setDb(next);
      toast.message(patch === "delete" ? "Column removed" : "Column updated");
    } catch {
      toast.error("Couldn't update column");
    }
  }

  function columnMenu(col: ColDef): QuickMenuEntry[] {
    const field = db?.fields.find((f) => f.name === col.key);
    const items: QuickMenuEntry[] = [
      {
        label: "Sort ascending",
        icon: ArrowUp,
        onSelect: () => setSort({ key: col.key, dir: "asc" }),
      },
      {
        label: "Sort descending",
        icon: ArrowDown,
        onSelect: () => setSort({ key: col.key, dir: "desc" }),
      },
      {
        label: "Clear sort",
        icon: ArrowUpDown,
        disabled: sort?.key !== col.key,
        onSelect: () => setSort(null),
      },
      { type: "separator" },
      {
        label: colFilters[col.key] ? "Clear filter" : "Filter column…",
        icon: Filter,
        onSelect: () => {
          if (colFilters[col.key]) {
            setColFilters((prev) => {
              const next = { ...prev };
              delete next[col.key];
              return next;
            });
            return;
          }
          const needle = window.prompt(`Filter “${col.label}” contains:`, colFilters[col.key] || "");
          if (needle == null) return;
          setColFilters((prev) => {
            const next = { ...prev };
            if (!needle.trim()) delete next[col.key];
            else next[col.key] = needle;
            return next;
          });
        },
      },
      {
        label: "Hide column",
        icon: EyeOff,
        onSelect: () => setHiddenCols((prev) => new Set(prev).add(col.key)),
      },
    ];

    if (col.schema) {
      items.push(
        { type: "separator" },
        {
          label: "Edit column schema",
          icon: Pencil,
          onSelect: () => openSchema({ field: col.key }),
        },
        {
          label: "Change type",
          icon: Settings2,
          children: (["string", "number", "boolean", "enum"] as const).map((type) => ({
            label: type,
            onSelect: () => void patchField(col.key, { type }),
          })),
        },
        {
          label: "Delete column",
          icon: Trash2,
          variant: "destructive",
          disabled: !field && col.key !== "summary" && col.key !== "success",
          onSelect: () => {
            if (!window.confirm(`Delete column “${col.label}”?`)) return;
            void patchField(col.key, "delete");
          },
        },
      );
    }

    items.push(
      { type: "separator" },
      {
        label: "Open schema",
        icon: Settings2,
        onSelect: () => openSchema(),
      },
    );

    return items;
  }

  if (loading && !db) {
    return (
      <div className="flex h-full min-h-0 flex-col px-4 py-5 md:px-6 md:py-6">
        <VoiceTableShimmer />
      </div>
    );
  }

  if (!db) {
    return (
      <div className="h-full overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        <Link to="/databases" className="text-sm text-muted-foreground hover:text-foreground">
          ← Databases
        </Link>
        <p className="mt-4">Database not found.</p>
      </div>
    );
  }

  const hasActiveFilters =
    successFilter !== "all" || Object.values(colFilters).some((v) => v.trim()) || hiddenCols.size > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <Link
              to="/databases"
              className="inline-flex items-center gap-0.5 hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Databases
            </Link>
            <span>/</span>
            <h1 className="truncate text-foreground text-title">{db.name}</h1>
          </div>

          <div className="relative ml-auto w-full max-w-xs min-w-[12rem] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-page-search
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search rows"
              className="pl-8"
            />
          </div>

          <Select
            value={successFilter}
            onValueChange={(v) => setSuccessFilter(v as "all" | "yes" | "no")}
          >
            <SelectTrigger className="w-[8.5rem]">
              <SelectValue placeholder="Success" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="yes">Success: Yes</SelectItem>
              <SelectItem value="no">Success: No</SelectItem>
            </SelectContent>
          </Select>

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
                    exportCallDatabase(db.id, fmt, appliedQ || undefined).catch(() =>
                      toast.error("Export failed"),
                    )
                  }
                >
                  {fmt.toUpperCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="rounded-full" onClick={() => openSchema()}>
            Schema
          </Button>
        </div>

        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {hiddenCols.size > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-full"
                onClick={() => setHiddenCols(new Set())}
              >
                Show {hiddenCols.size} hidden column{hiddenCols.size === 1 ? "" : "s"}
              </Button>
            ) : null}
            {Object.keys(colFilters).length > 0 || successFilter !== "all" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full"
                onClick={() => {
                  setColFilters({});
                  setSuccessFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 md:px-6">
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30">
              <tr>
                {columns.map((col, i) => {
                  const sorted = sort?.key === col.key ? sort.dir : null;
                  const filtered = Boolean(colFilters[col.key]?.trim());
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap border-b border-border bg-muted/80 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground backdrop-blur",
                        i < 3 && "sticky z-40",
                        i === 0 && "left-0",
                        i === 1 && "left-[9rem]",
                        i === 2 && "left-[18rem]",
                      )}
                    >
                      <QuickContextMenu title={col.label} items={columnMenu(col)}>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex max-w-[16rem] cursor-context-menu items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-muted hover:text-foreground",
                            (sorted || filtered) && "text-foreground",
                          )}
                          onClick={() => toggleSort(col.key)}
                        >
                          <span className="truncate">{col.label}</span>
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3 shrink-0" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3 shrink-0" />
                          ) : (
                            <ArrowUpDown className="size-3 shrink-0 opacity-40" />
                          )}
                          {filtered ? <Filter className="size-3 shrink-0 text-primary" /> : null}
                        </button>
                      </QuickContextMenu>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rowsLoading ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-muted-foreground"
                    colSpan={Math.max(columns.length, 1)}
                  >
                    Loading…
                  </td>
                </tr>
              ) : displayRows.length ? (
                displayRows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={cn(
                          "max-w-xs truncate border-b border-border px-3 py-2.5",
                          i < 3 && "sticky bg-card",
                          i === 0 && "left-0 z-10",
                          i === 1 && "left-[9rem] z-10",
                          i === 2 && "left-[18rem] z-10",
                        )}
                        title={cellValue(row, col.key)}
                      >
                        {cellValue(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-10 text-muted-foreground"
                    colSpan={Math.max(columns.length, 1)}
                  >
                    {appliedQ || hasActiveFilters
                      ? "No rows match this search or filter."
                      : "No rows yet. They appear here after calls finish."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <Select
              value={String(perPage)}
              onValueChange={(v) => {
                setPerPage(Number(v));
                setCursorStack([null]);
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-[4.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>Per page</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {total === 0
                ? "0 of 0"
                : `${(pageIndex - 1) * perPage + 1}–${Math.min(pageIndex * perPage, total)} of ${total}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canPrev || rowsLoading}
              onClick={() => {
                const stack = cursorStack.slice(0, -1);
                const cursor = stack[stack.length - 1] ?? null;
                setCursorStack(stack);
                void loadRows(cursor);
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canNext || rowsLoading}
              onClick={() => {
                if (!nextCursor) return;
                setCursorStack((prev) => [...prev, nextCursor]);
                void loadRows(nextCursor);
              }}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <SchemaSheet
        open={schemaOpen}
        onOpenChange={(open) => {
          setSchemaOpen(open);
          if (!open) setFocusField(null);
        }}
        db={db}
        initialTab={schemaTab}
        focusField={focusField}
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
  initialTab = "columns",
  focusField,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: CallDatabase;
  onSaved: (db: CallDatabase) => void;
  initialTab?: string;
  focusField?: string | null;
}) {
  const [fields, setFields] = useState<AnalysisField[]>(db.fields);
  const [destinations, setDestinations] = useState<DatabaseDestination[]>(db.destinations || []);
  const [agents, setAgents] = useState<CallDatabaseAgent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (!open) return;
    setFields(db.fields);
    setDestinations(db.destinations || []);
    setTab(initialTab);
    const { orgId, projectId } = requireScope();
    void Promise.all([
      listCallDatabaseAgents(db.id).then(setAgents),
      api.listAgents(orgId, projectId, { limit: 100 }).then((p) => setAllAgents(p.items)),
      api.listTools(orgId, { limit: 100 }).then((p) => setTools(p.items)),
      api.listComposioConnections(orgId).then(setConnections).catch(() => setConnections([])),
    ]);
  }, [open, db, initialTab]);

  useEffect(() => {
    if (!open || !focusField) return;
    const t = window.setTimeout(() => {
      document.getElementById(`schema-field-${focusField}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, focusField, fields]);

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
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="destinations">Destinations</TabsTrigger>
          </TabsList>
          <TabsContent value="columns" className="mt-4 space-y-3">
            {fields.map((field, idx) => (
              <div
                key={`${field.name}-${idx}`}
                id={field.name ? `schema-field-${field.name}` : undefined}
                className={cn(
                  "grid grid-cols-[1fr_7rem_1fr_auto] items-center gap-2 rounded-lg p-1",
                  focusField && field.name === focusField && "bg-muted/60 ring-1 ring-border",
                )}
              >
                <Input
                  value={field.name}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...field, name: e.target.value };
                    setFields(next);
                  }}
                  placeholder="name"
                  autoFocus={focusField === field.name}
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
