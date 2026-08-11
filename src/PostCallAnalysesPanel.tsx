import { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { AnalysisField, AnalysisFieldType, PostCallAnalysis } from "./types";

type Props = { orgId: string };

const FIELD_TYPES: AnalysisFieldType[] = ["string", "number", "boolean", "enum"];

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.listAnalyses(orgId).then(setAnalyses).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

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

  async function archive(id: string) {
    try {
      await api.archiveAnalysis(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel">
      <h2>Post-Call Analyses</h2>
      {error && <p className="error">{error}</p>}

      <div className="analysis-form">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <textarea
          placeholder="Grading prompt"
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        />
        <input
          placeholder="Eval LLM provider id"
          value={form.eval_llm_id}
          onChange={(e) => setForm({ ...form, eval_llm_id: e.target.value })}
        />
        <input
          placeholder="Webhook URL (optional)"
          value={form.webhook_url}
          onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
        />

        <h4>Fields</h4>
        {form.fields.map((f, i) => (
          <div key={i} className="field-row">
            <input placeholder="name" value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} />
            <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as AnalysisFieldType })}>
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              placeholder="description"
              value={f.description}
              onChange={(e) => updateField(i, { description: e.target.value })}
            />
            {f.type === "enum" && (
              <input
                placeholder="comma-separated values"
                value={(f.enum_values || []).join(",")}
                onChange={(e) => updateField(i, { enum_values: e.target.value.split(",").map((s) => s.trim()) })}
              />
            )}
            <button onClick={() => removeField(i)}>Remove</button>
          </div>
        ))}
        <button onClick={addField}>Add field</button>
        <button onClick={submit}>{editingId ? "Save" : "Create analysis"}</button>
      </div>

      <ul className="analysis-list">
        {analyses.map((a) => (
          <li key={a.id}>
            {a.name}
            <button
              onClick={() => {
                setEditingId(a.id);
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
            </button>
            <button onClick={() => archive(a.id)}>Archive</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
