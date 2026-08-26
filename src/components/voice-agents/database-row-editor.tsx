import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DIRECTION_META, NotionChip, formatDuration, formatWhen } from "@/components/voice-agents/database-notion-cell";
import { patchCallDatabase, patchCallDatabaseRow, type AnalysisField, type CallDatabase, type CallDatabaseRow } from "@/lib/api/voice/databases";

const FIELD_TYPES = ["string", "number", "boolean", "enum"] as const;

function editorString(value: unknown, type: AnalysisField["type"]): string {
  if (value == null) return "";
  if (type === "boolean") {
    if (typeof value === "boolean") return value ? "true" : "false";
    const s = String(value).trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(s)) return "true";
    if (["no", "false", "n", "0"].includes(s)) return "false";
    return "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function parseValue(type: AnalysisField["type"], raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "__empty__") return null;
  if (type === "boolean") return trimmed === "true" || trimmed === "yes";
  if (type === "number") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : trimmed;
  }
  return raw;
}

export function DatabaseRowEditor({
  open,
  onOpenChange,
  db,
  row,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: CallDatabase;
  row: CallDatabaseRow | null;
  onSaved: (next: { db: CallDatabase; row: CallDatabaseRow }) => void;
}) {
  const [who, setWho] = useState("");
  const [fields, setFields] = useState<AnalysisField[]>(db.fields);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setWho(row.who_called || "");
    setFields(db.fields);
    const next: Record<string, string> = {};
    for (const field of db.fields) {
      next[field.name] = editorString(row.values?.[field.name], field.type);
    }
    setValues(next);
  }, [open, row, db]);

  const directionMeta = row?.direction ? DIRECTION_META[row.direction] : null;
  const DirectionIcon = directionMeta?.Icon;

  async function save() {
    if (!row) return;
    setSaving(true);
    try {
      const nextValues: Record<string, unknown> = { ...(row.values || {}) };
      for (const field of fields) {
        if (!field.name.trim()) continue;
        nextValues[field.name] = parseValue(field.type, values[field.name] ?? "");
      }
      const fieldsChanged =
        JSON.stringify(fields) !== JSON.stringify(db.fields);
      const nextDb = fieldsChanged
        ? await patchCallDatabase(db.id, { fields: fields.filter((f) => f.name.trim()) })
        : db;
      const nextRow = await patchCallDatabaseRow(db.id, row.id, {
        who_called: who,
        values: nextValues,
      });
      onSaved({ db: nextDb, row: nextRow });
      toast.message("Row updated");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't update row");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetTitle>Edit row</SheetTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Change values on this call, or the column type for the whole table.
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="row-who">Who called</Label>
            <Input
              id="row-who"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Phone or participant"
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Direction</Label>
              <div className="flex h-9 items-center">
                {directionMeta && DirectionIcon ? (
                  <NotionChip className={directionMeta.className}>
                    <DirectionIcon className="size-3 opacity-80" />
                    {directionMeta.label}
                  </NotionChip>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Duration</Label>
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {formatDuration(row?.duration_seconds ?? null)}
                {row?.started_at ? ` · ${formatWhen(row.started_at)}` : ""}
              </p>
            </div>
          </div>

          {fields.map((field, idx) => (
            <div key={`${field.name}-${idx}`} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`row-field-${field.name}`} className="truncate font-mono text-xs">
                  {field.name || "untitled"}
                </Label>
                <Select
                  value={field.type}
                  onValueChange={(type) => {
                    const next = [...fields];
                    next[idx] = { ...field, type: type as AnalysisField["type"] };
                    setFields(next);
                  }}
                >
                  <SelectTrigger size="sm" className="h-7 w-[7.5rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field.type === "boolean" ? (
                <Select
                  value={values[field.name] || "__empty__"}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v === "__empty__" ? "" : v }))}
                >
                  <SelectTrigger id={`row-field-${field.name}`}>
                    <SelectValue placeholder="Empty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Empty</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : field.type === "enum" && field.enum_values?.length ? (
                <Select
                  value={values[field.name] || "__empty__"}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, [field.name]: v === "__empty__" ? "" : v }))}
                >
                  <SelectTrigger id={`row-field-${field.name}`}>
                    <SelectValue placeholder="Empty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Empty</SelectItem>
                    {field.enum_values.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.name === "summary" || (field.type === "string" && (values[field.name] || "").length > 80) ? (
                <Textarea
                  id={`row-field-${field.name}`}
                  value={values[field.name] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <Input
                  id={`row-field-${field.name}`}
                  type={field.type === "number" ? "number" : "text"}
                  value={values[field.name] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !row}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
