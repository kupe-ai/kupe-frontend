import { readStore, scopedKey, writeStore } from "@/lib/api/local-store";
import { requireScope } from "@/lib/api/workspace-scope";

export interface VoiceEvaluationCriteria {
  id: string;
  name: string;
  source_format: "json" | "yaml" | "csv";
  created_at: string;
}

function key() {
  const { orgId } = requireScope();
  return scopedKey("eval", orgId);
}

export async function listEvaluationCriteria() {
  return readStore<VoiceEvaluationCriteria[]>(key(), []);
}

export async function uploadEvaluationCriteria(name: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const source_format: VoiceEvaluationCriteria["source_format"] =
    ext === "yaml" || ext === "yml" ? "yaml" : ext === "csv" ? "csv" : "json";
  const row: VoiceEvaluationCriteria = {
    id: crypto.randomUUID(),
    name,
    source_format,
    created_at: new Date().toISOString(),
  };
  writeStore(key(), [row, ...readStore<VoiceEvaluationCriteria[]>(key(), [])]);
  return row;
}
