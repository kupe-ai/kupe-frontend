import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { missingColumnsForRecipients } from "@/lib/campaign-template-vars";
import { listRecipientLists, type RecipientList } from "@/lib/api/voice/campaigns";
import {
  PHONE_COLUMN,
  analyzeRecipients,
  emptyRecipientRow,
  isBlankRecipient,
  newRecipientId,
  parseRecipientsCsv,
  type RecipientRow,
} from "@/lib/parse-recipients-csv";

export type RecipientsMode = "new" | "saved";

export type RecipientsState = {
  mode: RecipientsMode;
  listName: string;
  selectedListId: string | null;
  columns: string[];
  rows: RecipientRow[];
  csvError: string | null;
  csvFileName: string | null;
};

export function createEmptyRecipientsState(): RecipientsState {
  const columns = [PHONE_COLUMN];
  return {
    mode: "new",
    listName: "",
    selectedListId: null,
    columns,
    rows: [emptyRecipientRow(columns)],
    csvError: null,
    csvFileName: null,
  };
}

function withColumns(row: RecipientRow, columns: string[]): RecipientRow {
  const values = { ...row.values };
  for (const col of columns) {
    if (values[col] == null) values[col] = "";
  }
  return { ...row, values };
}

function ensureTrailingBlank(columns: string[], rows: RecipientRow[]): RecipientRow[] {
  const next = rows.map((row) => withColumns(row, columns));
  if (next.length === 0 || !isBlankRecipient(next[next.length - 1], columns)) {
    next.push(emptyRecipientRow(columns));
  }
  return next;
}

export function RecipientsStep({
  value,
  onChange,
  hideModeToggle = false,
  hideListName = false,
  requiredVariables = [],
}: {
  value: RecipientsState;
  onChange: (next: RecipientsState) => void;
  hideModeToggle?: boolean;
  hideListName?: boolean;
  /** Agent template keys that must exist as columns / member variables. */
  requiredVariables?: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftPhone, setDraftPhone] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [savedLists, setSavedLists] = useState<RecipientList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const analysis = analyzeRecipients(value.columns, value.rows);
  const emptyEntries = Object.entries(analysis.emptyCells).filter(([, count]) => count > 0);
  const selected = savedLists.find((l) => l.id === value.selectedListId) ?? null;
  const missingRequiredCols =
    value.mode === "new" ? missingColumnsForRecipients(requiredVariables, value.columns) : [];

  useEffect(() => {
    setListsLoading(true);
    listRecipientLists({ limit: 100 })
      .then((page) => setSavedLists(page.items))
      .catch(() => setSavedLists([]))
      .finally(() => setListsLoading(false));
  }, []);

  const requiredKey = requiredVariables.join("\0");
  useEffect(() => {
    if (value.mode !== "new") return;
    const keys = requiredKey ? requiredKey.split("\0") : [];
    const missing = missingColumnsForRecipients(keys, value.columns);
    if (!missing.length) return;
    const columns = [...value.columns, ...missing];
    onChange({
      ...value,
      columns,
      rows: ensureTrailingBlank(columns, value.rows),
    });
  }, [requiredKey, value.mode]);

  function patch(partial: Partial<RecipientsState>) {
    onChange({ ...value, ...partial });
  }

  function setRows(rows: RecipientRow[], columns = value.columns) {
    patch({ columns, rows: ensureTrailingBlank(columns, rows) });
  }

  function addPhone(raw: string) {
    const phone = raw.trim();
    if (!phone) return;
    const blankIdx = value.rows.findIndex((row) => !row.values[PHONE_COLUMN]?.trim());
    if (blankIdx >= 0) {
      const rows = value.rows.map((row, i) =>
        i === blankIdx ? { ...row, values: { ...row.values, [PHONE_COLUMN]: phone } } : row,
      );
      setRows(rows);
    } else {
      const row = emptyRecipientRow(value.columns);
      row.values[PHONE_COLUMN] = phone;
      setRows([...value.rows, row]);
    }
    setDraftPhone("");
  }

  function updateCell(rowId: string, column: string, cellValue: string) {
    setRows(
      value.rows.map((row) =>
        row.id === rowId ? { ...row, values: { ...row.values, [column]: cellValue } } : row,
      ),
    );
  }

  function removeRow(rowId: string) {
    const remaining = value.rows.filter((row) => row.id !== rowId);
    setRows(remaining.length ? remaining : [emptyRecipientRow(value.columns)]);
  }

  async function ingestCsv(file: File) {
    const text = await file.text();
    const parsed = parseRecipientsCsv(text);
    if (!parsed.ok) {
      patch({ csvError: parsed.error, csvFileName: file.name });
      toast.error(parsed.error);
      return;
    }
    const extra = parsed.columns.filter((col) => !value.columns.includes(col));
    const columns = extra.length ? [...value.columns, ...extra] : value.columns;
    const existing = value.rows.filter((row) => !isBlankRecipient(row, value.columns));
    const imported: RecipientRow[] = parsed.rows.map((values) => ({
      id: newRecipientId(),
      values: Object.fromEntries(columns.map((col) => [col, values[col] ?? ""])),
    }));
    onChange({
      ...value,
      mode: "new",
      columns,
      rows: ensureTrailingBlank(columns, [...existing, ...imported]),
      csvError: null,
      csvFileName: file.name,
      listName: value.listName.trim() || file.name.replace(/\.csv$/i, ""),
    });
    toast.message(`Added ${parsed.rows.length} ${parsed.rows.length === 1 ? "person" : "people"} from ${file.name}`);
  }

  return (
    <div className="min-w-0 space-y-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Recipients</p>
          <p className="text-muted-foreground">
            Save people as a named list you can reuse, or pick an older list.
          </p>
        </div>
        {value.mode === "new" ? (
          <Badge variant="secondary" className="shrink-0">
            {analysis.people} {analysis.people === 1 ? "person" : "people"}
          </Badge>
        ) : selected ? (
          <Badge variant="secondary" className="shrink-0">
            {selected.member_count} {selected.member_count === 1 ? "person" : "people"}
          </Badge>
        ) : null}
      </div>

      {requiredVariables.length > 0 ? (
        <Alert
          variant={missingRequiredCols.length ? "destructive" : "default"}
          className="min-w-0 overflow-hidden"
        >
          <AlertDescription className="min-w-0 space-y-2">
            <p className="text-pretty">
              {missingRequiredCols.length
                ? "This agent needs these fields on every recipient — add the missing columns before launch."
                : "Fill these fields for each recipient so the agent can use them."}
            </p>
            <div className="flex flex-wrap gap-1">
              {requiredVariables.map((key) => (
                <Badge
                  key={key}
                  variant={missingRequiredCols.includes(key) ? "destructive" : "secondary"}
                  className="max-w-full font-mono text-[11px]"
                >
                  <span className="truncate">{`{{${key}}}`}</span>
                </Badge>
              ))}
            </div>
            {missingRequiredCols.length > 0 && value.mode === "new" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  const columns = [...value.columns];
                  for (const key of missingRequiredCols) {
                    if (!columns.includes(key)) columns.push(key);
                  }
                  setRows(value.rows, columns);
                }}
              >
                Add missing columns
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!hideModeToggle ? (
        <div className="inline-flex rounded-full bg-muted/70 p-1">
          {(
            [
              ["new", "New list"],
              ["saved", "Saved lists"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ mode: id })}
              className={cn(
                "pressable rounded-full px-3.5 py-1.5 text-sm",
                value.mode === id
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {value.mode === "saved" ? (
        <div className="space-y-2">
          <Label>Choose a saved list</Label>
          <Select
            value={value.selectedListId ?? ""}
            onValueChange={(id) => patch({ selectedListId: id })}
            disabled={listsLoading || savedLists.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  listsLoading
                    ? "Loading lists…"
                    : savedLists.length
                      ? "Select a recipient list"
                      : "No saved lists yet — create one"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {savedLists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name} · {list.member_count} people
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <p className="text-xs text-muted-foreground">
              This list will be copied into the campaign when you continue. Dial status lives on the
              campaign — the saved list stays reusable.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {!hideListName ? (
            <div className="space-y-1.5">
              <Label>
                List name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={value.listName}
                onChange={(e) => patch({ listName: e.target.value })}
                placeholder="Give this list a name"
              />
            </div>
          ) : null}

          <div className="flex gap-2">
            <Input
              value={draftPhone}
              onChange={(e) => setDraftPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhone(draftPhone);
                }
              }}
              placeholder="Add a phone number"
              aria-label="Recipient phone"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 rounded-full"
              onClick={() => addPhone(draftPhone)}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>

          <button
            type="button"
            className={cn(
              "flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground hover:bg-muted/30",
              dragOver && "border-primary bg-primary/5 text-foreground",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void ingestCsv(file);
            }}
          >
            <Upload className="size-5" />
            {value.csvFileName ? value.csvFileName : "Drop a CSV here or click to choose"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void ingestCsv(file);
            }}
          />

          {value.csvError ? (
            <Alert variant="destructive">
              <AlertDescription>{value.csvError}</AlertDescription>
            </Alert>
          ) : null}

          {analysis.dataRowCount > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {emptyEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">All cells filled.</p>
              ) : (
                emptyEntries.map(([col, count]) => (
                  <Badge key={col} variant={col === PHONE_COLUMN ? "destructive" : "warning"}>
                    {count} empty in {col}
                  </Badge>
                ))
              )}
            </div>
          ) : null}

          <div className="max-h-[240px] w-full min-w-0 overflow-auto rounded-xl border border-border">
            <table className="w-max min-w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border">
                  {value.columns.map((col, colIndex) => (
                    <th
                      key={col}
                      className={cn(
                        "h-9 p-1.5 text-left text-xs font-medium tracking-wide text-muted-foreground",
                        colIndex === 0 && "sticky left-0 z-20 bg-background",
                      )}
                    >
                      <span className="block max-w-[10rem] truncate px-2.5" title={col}>
                        {col}
                        {col === PHONE_COLUMN ? " *" : ""}
                      </span>
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 w-10 bg-background p-1.5" />
                </tr>
              </thead>
              <tbody>
                {value.rows.map((row, index) => {
                  const blank = isBlankRecipient(row, value.columns);
                  const phoneEmpty = !row.values[PHONE_COLUMN]?.trim();
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      {value.columns.map((col, colIndex) => {
                        const empty = !row.values[col]?.trim();
                        const invalid = !blank && empty;
                        return (
                          <td
                            key={col}
                            className={cn("p-1.5", colIndex === 0 && "sticky left-0 z-10 bg-background")}
                          >
                            <Input
                              value={row.values[col] ?? ""}
                              onChange={(e) => updateCell(row.id, col, e.target.value)}
                              placeholder={col === PHONE_COLUMN ? "Phone" : ""}
                              aria-invalid={invalid}
                              aria-label={`${col} row ${index + 1}`}
                              className={cn(
                                "w-40",
                                invalid && col === PHONE_COLUMN && phoneEmpty
                                  ? "border-destructive"
                                  : undefined,
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 bg-background p-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          onClick={() => removeRow(row.id)}
                          disabled={value.rows.length === 1 && blank}
                          aria-label={`Remove recipient ${index + 1}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setRows([...value.rows, emptyRecipientRow(value.columns)])}
          >
            <Plus className="size-3.5" />
            Add recipient
          </Button>
        </>
      )}
    </div>
  );
}
