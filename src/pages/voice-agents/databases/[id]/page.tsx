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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  deleteCallDatabaseRow,
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
import {
  DatabaseCell,
  cellText,
  rawValue,
} from "@/components/voice-agents/database-notion-cell";
import { DatabaseRowEditor } from "@/components/voice-agents/database-row-editor";

const SYSTEM_COLS = [
  { key: "who_called", label: "Who called", schema: false },
  { key: "direction", label: "Direction", schema: false },
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

const SYSTEM_FIELD_NAMES = new Set([
  "summary",
  "success",
  "who_called",
  "direction",
  "started_at",
  "duration_seconds",
]);

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

function isFilledValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Count rows (on the loaded page) that have a non-empty value for this column. */
function filledCountForColumn(rows: CallDatabaseRow[], key: string): number {
  return rows.reduce((n, row) => n + (isFilledValue(rawValue(row, key)) ? 1 : 0), 0);
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
  const [columnToDelete, setColumnToDelete] = useState<{ key: string; label: string } | null>(null);
  const [deletingColumn, setDeletingColumn] = useState(false);
  const [editingRow, setEditingRow] = useState<CallDatabaseRow | null>(null);
  const [rowToDelete, setRowToDelete] = useState<CallDatabaseRow | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);

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
      .filter((f) => f.name !== "summary" && f.name !== "success" && !SYSTEM_FIELD_NAMES.has(f.name))
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
          cellText(row, key).toLowerCase().includes(needle.trim().toLowerCase()),
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
      if (patch === "delete") {
        setRows((prev) =>
          prev.map((row) => {
            if (!(name in (row.values || {}))) return row;
            const values = { ...row.values };
            delete values[name];
            return { ...row, values };
          }),
        );
      }
    } catch {
      toast.error("Couldn't update column");
    }
  }

  async function confirmDeleteColumn() {
    if (!columnToDelete) return;
    setDeletingColumn(true);
    try {
      await patchField(columnToDelete.key, "delete");
      setColumnToDelete(null);
    } finally {
      setDeletingColumn(false);
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
          onSelect: () => setColumnToDelete({ key: col.key, label: col.label }),
        },
      );
    }

    items.push(
      { type: "separator" },
      {
        label: "Manage columns",
        icon: Settings2,
        onSelect: () => openSchema({ tab: "columns" }),
      },
    );

    return items;
  }

  function rowMenu(row: CallDatabaseRow): QuickMenuEntry[] {
    const schemaCols = allColumns.filter((c) => c.schema);
    return [
      {
        label: "Edit row",
        icon: Pencil,
        onSelect: () => setEditingRow(row),
      },
      {
        label: "Change type",
        icon: Settings2,
        disabled: schemaCols.length === 0,
        children: schemaCols.map((col) => ({
          label: col.label,
          children: (["string", "number", "boolean", "enum"] as const).map((type) => ({
            label: type,
            onSelect: () => void patchField(col.key, { type }),
          })),
        })),
      },
      { type: "separator" },
      {
        label: "Delete row",
        icon: Trash2,
        variant: "destructive",
        onSelect: () => setRowToDelete(row),
      },
    ];
  }

  async function confirmDeleteRow() {
    if (!rowToDelete || !db) return;
    setDeletingRow(true);
    try {
      await deleteCallDatabaseRow(db.id, rowToDelete.id);
      setRows((prev) => prev.filter((r) => r.id !== rowToDelete.id));
      setTotal((n) => Math.max(0, n - 1));
      setRowToDelete(null);
      toast.message("Row deleted");
    } catch {
      toast.error("Couldn't delete row");
    } finally {
      setDeletingRow(false);
    }
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
                        i < 2 && "sticky z-40",
                        i === 0 && "left-0 min-w-[11rem]",
                        i === 1 && "left-[11rem] min-w-[8.5rem]",
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
                  <QuickContextMenu
                    key={row.id}
                    title={row.who_called || "Call"}
                    items={rowMenu(row)}
                  >
                    <tr className="group cursor-context-menu hover:bg-muted/40 data-[state=open]:bg-muted/60">
                      {columns.map((col, i) => (
                        <td
                          key={col.key}
                          className={cn(
                            "max-w-xs border-b border-border px-3 py-2.5",
                            i < 2 && "sticky bg-card group-hover:bg-muted/40 group-data-[state=open]:bg-muted/60",
                            i === 0 && "left-0 z-10 min-w-[11rem]",
                            i === 1 && "left-[11rem] z-10 min-w-[8.5rem]",
                          )}
                          title={cellText(row, col.key)}
                        >
                          <DatabaseCell
                            row={row}
                            colKey={col.key}
                            field={db.fields.find((f) => f.name === col.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  </QuickContextMenu>
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
        rows={rows}
        total={total}
        initialTab={schemaTab}
        focusField={focusField}
        onSaved={(next) => {
          setDb(next);
          const kept = new Set((next.fields || []).map((f) => f.name));
          setRows((prev) =>
            prev.map((row) => {
              const values = { ...row.values };
              let changed = false;
              for (const key of Object.keys(values)) {
                if (!kept.has(key)) {
                  delete values[key];
                  changed = true;
                }
              }
              return changed ? { ...row, values } : row;
            }),
          );
        }}
      />

      <AlertDialog
        open={!!columnToDelete}
        onOpenChange={(next) => !next && !deletingColumn && setColumnToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {columnToDelete && filledCountForColumn(rows, columnToDelete.key) > 0
                ? "Delete column with data?"
                : "Delete column?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {columnToDelete ? (
                filledCountForColumn(rows, columnToDelete.key) > 0 ? (
                  <>
                    “{columnToDelete.label}” has filled data in{" "}
                    {filledCountForColumn(rows, columnToDelete.key)} row
                    {filledCountForColumn(rows, columnToDelete.key) === 1 ? "" : "s"}
                    {total > rows.length ? " on this page (more may exist)" : ""}. Deleting removes
                    the column and its values from this database.
                  </>
                ) : (
                  <>
                    Delete column “{columnToDelete.label}”? This can’t be undone from the schema.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingColumn}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={deletingColumn}
              onClick={() => void confirmDeleteColumn()}
            >
              {deletingColumn ? "Deleting…" : "Delete column"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DatabaseRowEditor
        open={!!editingRow}
        onOpenChange={(open) => {
          if (!open) setEditingRow(null);
        }}
        db={db}
        row={editingRow}
        onSaved={({ db: nextDb, row: nextRow }) => {
          setDb(nextDb);
          setRows((prev) => prev.map((r) => (r.id === nextRow.id ? nextRow : r)));
        }}
      />

      <AlertDialog
        open={!!rowToDelete}
        onOpenChange={(next) => !next && !deletingRow && setRowToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this row?</AlertDialogTitle>
            <AlertDialogDescription>
              {rowToDelete
                ? `Remove the call from ${rowToDelete.who_called || "this row"}? This only deletes the database row, not the call recording.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRow}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={deletingRow}
              onClick={() => void confirmDeleteRow()}
            >
              {deletingRow ? "Deleting…" : "Delete row"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SchemaSheet({
  open,
  onOpenChange,
  db,
  rows,
  total,
  onSaved,
  initialTab = "columns",
  focusField,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: CallDatabase;
  rows: CallDatabaseRow[];
  total: number;
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
  const [pendingRemove, setPendingRemove] = useState<{ idx: number; name: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFields(db.fields);
    setDestinations(db.destinations || []);
    setTab(initialTab);
    setPendingRemove(null);
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

  function requestRemoveField(idx: number) {
    const field = fields[idx];
    const name = field?.name?.trim() || "";
    if (!name) {
      setFields(fields.filter((_, i) => i !== idx));
      return;
    }
    const filled = filledCountForColumn(rows, name);
    if (filled > 0) {
      setPendingRemove({ idx, name });
      return;
    }
    setFields(fields.filter((_, i) => i !== idx));
  }

  function confirmRemoveField() {
    if (!pendingRemove) return;
    setFields(fields.filter((_, i) => i !== pendingRemove.idx));
    setPendingRemove(null);
  }

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

  const pendingFilled =
    pendingRemove != null ? filledCountForColumn(rows, pendingRemove.name) : 0;

  return (
    <>
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
              <p className="text-xs text-muted-foreground">
                Add, rename, or remove columns. Removing a column with filled data will delete those
                values when you save.
              </p>
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
                    aria-label={`Remove column ${field.name || idx + 1}`}
                    onClick={() => requestRemoveField(idx)}
                  >
                    <Trash2 className="size-4 text-destructive" />
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

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(next) => !next && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete column with data?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove ? (
                <>
                  “{pendingRemove.name}” has filled data in {pendingFilled} row
                  {pendingFilled === 1 ? "" : "s"}
                  {total > rows.length ? " on this page (more may exist)" : ""}. Removing it and
                  saving will permanently delete those values.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" className="rounded-full" onClick={confirmRemoveField}>
              Remove column
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
