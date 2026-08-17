"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PARAM_TYPES = ["string", "number", "integer", "boolean", "array", "object"] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

export type ToolParamRow = {
  key: string;
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
};

export function emptyParamRow(): ToolParamRow {
  return {
    key: crypto.randomUUID(),
    name: "",
    type: "string",
    description: "",
    required: true,
  };
}

export function schemaToParamRows(
  parameters: Record<string, unknown> | null | undefined,
  required: string[] | null | undefined,
): ToolParamRow[] {
  const req = new Set(required ?? []);
  const entries = Object.entries(parameters ?? {});
  if (entries.length === 0) return [];
  return entries.map(([name, spec]) => {
    const s = spec && typeof spec === "object" ? (spec as Record<string, unknown>) : {};
    const type = PARAM_TYPES.includes(s.type as ParamType) ? (s.type as ParamType) : "string";
    return {
      key: crypto.randomUUID(),
      name,
      type,
      description: typeof s.description === "string" ? s.description : "",
      required: req.has(name),
    };
  });
}

export function paramRowsToSchema(rows: ToolParamRow[]): {
  parameters: Record<string, { type: string; description: string }>;
  required: string[];
} {
  const parameters: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    parameters[name] = { type: row.type, description: row.description.trim() };
    if (row.required) required.push(name);
  }
  return { parameters, required };
}

export function parameterHintForMethod(method: string): string {
  if (method === "GET" || method === "DELETE") {
    return "Sent as query-string parameters. The LLM fills these from the conversation.";
  }
  return "Sent as a JSON body. The LLM fills these from the conversation.";
}

export function ToolParametersEditor({
  rows,
  onChange,
  hint,
}: {
  rows: ToolParamRow[];
  onChange: (rows: ToolParamRow[]) => void;
  hint?: string;
}) {
  function update(key: string, patch: Partial<ToolParamRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label>Parameters</Label>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full"
          onClick={() => onChange([...rows, emptyParamRow()])}
        >
          <Plus className="size-3.5" />
          Add parameter
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No parameters yet. Add one so the LLM knows what to send — name, type, and a description for each.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="space-y-1.5 rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder="name"
                  className="h-8 font-mono text-xs"
                />
                <Select value={row.type} onValueChange={(v) => update(row.key, { type: v as ParamType })}>
                  <SelectTrigger className="h-8 w-[118px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARAM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={row.required}
                    onCheckedChange={(v) => update(row.key, { required: v === true })}
                  />
                  Required
                </label>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  aria-label="Remove parameter"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <Input
                value={row.description}
                onChange={(e) => update(row.key, { description: e.target.value })}
                placeholder="Description — the LLM reads this"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
