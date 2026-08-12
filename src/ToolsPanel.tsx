import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { api } from "@/lib/api";
import type { CatalogTool } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = { orgId: string };

const PAGE_SIZE = 20;
const EMPTY = {
  name: "",
  description: "",
  parameters: "{\n}",
  required: "",
  http_url: "",
  http_method: "POST" as string,
  http_headers: "{\n}",
};

const BUILTINS = [
  { name: "end_call", description: "End the current call when the user asks to hang up.", parameters: {}, required: [] as string[] },
  { name: "get_current_time", description: "Get the current date and time as ISO-8601.", parameters: {}, required: [] as string[] },
  {
    name: "transfer_to_human",
    description: "Transfer the call to a human agent.",
    parameters: { reason: { type: "string", description: "Why the call is being transferred." } },
    required: ["reason"],
  },
];

export function ToolsPanel({ orgId }: Props) {
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    api
      .listTools(orgId, { limit: PAGE_SIZE, offset })
      .then((page) => {
        setTools(page.items);
        setTotal(page.total);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, offset]);

  async function submit() {
    try {
      const parameters = JSON.parse(form.parameters || "{}");
      const http_headers = form.http_url ? JSON.parse(form.http_headers || "{}") : {};
      const body = {
        name: form.name,
        description: form.description,
        parameters,
        required: form.required
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        http_url: form.http_url || null,
        http_method: form.http_url ? form.http_method : null,
        http_headers,
      };
      if (editingId) await api.updateTool(editingId, body);
      else await api.createTool(orgId, body);
      setForm(EMPTY);
      setEditingId(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addBuiltins() {
    try {
      for (const tool of BUILTINS) {
        if (tools.some((t) => t.name === tool.name)) continue;
        await api.createTool(orgId, tool);
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit tool" : "Create tool"}</CardTitle>
          <CardDescription>
            Client tools need a name and schema. HTTP URL is required to attach a tool to post-call analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Parameters JSON</Label>
            <Textarea rows={5} value={form.parameters} onChange={(e) => setForm({ ...form, parameters: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Required fields (comma-separated)</Label>
            <Input value={form.required} onChange={(e) => setForm({ ...form, required: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>HTTP URL (analysis tools)</Label>
              <Input value={form.http_url} onChange={(e) => setForm({ ...form, http_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={form.http_method} onValueChange={(v) => setForm({ ...form, http_method: v })}>
                <SelectTrigger>
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
            <div className="space-y-2 sm:col-span-2">
              <Label>HTTP headers JSON</Label>
              <Textarea rows={3} value={form.http_headers} onChange={(e) => setForm({ ...form, http_headers: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submit()}>{editingId ? "Save" : "Create tool"}</Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            )}
            <Button variant="outline" onClick={() => void addBuiltins()}>
              Add builtin tools
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>Attach these from the agent builder or an analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tools.length === 0 && <p className="text-sm text-muted-foreground">No tools yet.</p>}
          {tools.map((tool) => (
            <div key={tool.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{tool.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {tool.http_url ? `HTTP ${tool.http_method}` : "Client-executed"}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingId(tool.id);
                  setForm({
                    name: tool.name,
                    description: tool.description,
                    parameters: JSON.stringify(tool.parameters ?? {}, null, 2),
                    required: (tool.required ?? []).join(", "),
                    http_url: tool.http_url ?? "",
                    http_method: tool.http_method ?? "POST",
                    http_headers: "{\n}",
                  });
                }}
              >
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void api.archiveTool(tool.id).then(refresh)}>
                Archive
              </Button>
            </div>
          ))}
          <PaginationControls total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
        </CardContent>
      </Card>
    </div>
  );
}
