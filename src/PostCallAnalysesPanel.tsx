import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/config";
import { PaginationControls } from "@/components/PaginationControls";
import { api } from "@/lib/api";
import type { AgentTool, AnalysisField, AnalysisFieldType, CatalogTool, PostCallAnalysis, ProvidersResponse } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = { orgId: string };

const FIELD_TYPES: AnalysisFieldType[] = ["string", "number", "boolean", "enum"];
const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: "",
  description: "",
  prompt: "",
  eval_llm_id: "",
  webhook_url: "",
  fields: [] as AnalysisField[],
};

export function PostCallAnalysesPanel({ orgId }: Props) {
  const [analyses, setAnalyses] = useState<PostCallAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orgTools, setOrgTools] = useState<CatalogTool[]>([]);
  const [attachedTools, setAttachedTools] = useState<AgentTool[]>([]);
  const [attachToolId, setAttachToolId] = useState("");

  const refresh = () =>
    api
      .listAnalyses(orgId, { limit: PAGE_SIZE, offset })
      .then((page) => {
        setAnalyses(page.items);
        setTotal(page.total);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    fetch(`${BACKEND_URL}/v1/providers`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((res: ProvidersResponse) => setProviders(res))
      .catch(() => {});
    api.listTools(orgId, { limit: 100 }).then((page) => setOrgTools(page.items.filter((t) => t.http_url))).catch(() => {});
  }, [orgId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, offset]);

  function addField() {
    setForm({ ...form, fields: [...form.fields, { name: "", type: "string", description: "" }] });
  }

  function updateField(index: number, patch: Partial<AnalysisField>) {
    const fields = form.fields.slice();
    fields[index] = { ...fields[index], ...patch };
    setForm({ ...form, fields });
  }

  function removeField(index: number) {
    setForm({ ...form, fields: form.fields.filter((_, i) => i !== index) });
  }

  async function submit() {
    try {
      const body = { ...form, webhook_url: form.webhook_url || null };
      if (editingId) await api.updateAnalysis(editingId, body);
      else await api.createAnalysis(orgId, body);
      setForm(EMPTY_FORM);
      setEditingId(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadTools(analysisId: string) {
    const page = await api.listAnalysisTools(analysisId, { limit: 100 });
    setAttachedTools(page.items);
  }

  async function addTool() {
    if (!editingId || !attachToolId) return;
    await api.attachAnalysisTool(editingId, attachToolId, true);
    setAttachToolId("");
    await loadTools(editingId);
  }

  async function archive(id: string) {
    try {
      await api.archiveAnalysis(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit analysis" : "Create analysis"}</CardTitle>
          <CardDescription>Define grading prompt and structured output fields.</CardDescription>
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
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Grading prompt</Label>
            <Textarea rows={4} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Eval LLM</Label>
              <Select
                value={form.eval_llm_id || undefined}
                onValueChange={(v) => setForm({ ...form, eval_llm_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select LLM" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.model_providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.provider_name} / {p.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                Add field
              </Button>
            </div>
            {form.fields.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                <Input placeholder="name" value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} />
                <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as AnalysisFieldType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="sm:col-span-2"
                  placeholder="description"
                  value={f.description}
                  onChange={(e) => updateField(i, { description: e.target.value })}
                />
                {f.type === "enum" && (
                  <Input
                    className="sm:col-span-2"
                    placeholder="comma-separated values"
                    value={(f.enum_values || []).join(",")}
                    onChange={(e) =>
                      updateField(i, { enum_values: e.target.value.split(",").map((s) => s.trim()) })
                    }
                  />
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => removeField(i)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>

          {editingId && (
            <div className="space-y-2">
              <Label>HTTP tools</Label>
              <div className="flex flex-wrap gap-2">
                <Select value={attachToolId || undefined} onValueChange={setAttachToolId}>
                  <SelectTrigger className="min-w-[220px] flex-1">
                    <SelectValue placeholder="Select HTTP tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgTools
                      .filter((t) => !attachedTools.some((x) => x.id === t.id))
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void addTool()} disabled={!attachToolId}>
                  Attach
                </Button>
              </div>
              {attachedTools.map((tool) => (
                <div key={tool.id} className="flex items-center gap-2 text-sm">
                  <span>{tool.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => void api.detachAnalysisTool(editingId, tool.id).then(() => loadTools(editingId))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => void submit()}>{editingId ? "Save" : "Create analysis"}</Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved analyses</CardTitle>
          <CardDescription>Edit or archive existing definitions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {analyses.length === 0 && <p className="text-sm text-muted-foreground">No analyses yet.</p>}
          {analyses.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                {a.description && <div className="truncate text-xs text-muted-foreground">{a.description}</div>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingId(a.id);
                  void loadTools(a.id);
                  setForm({
                    name: a.name,
                    description: a.description ?? "",
                    prompt: a.prompt,
                    eval_llm_id: a.eval_llm_id,
                    webhook_url: a.webhook_url ?? "",
                    fields: a.fields,
                  });
                }}
              >
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void archive(a.id)}>
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
