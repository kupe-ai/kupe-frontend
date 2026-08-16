import { readStore, scopedKey, writeStore } from "@/lib/api/local-store";
import { requireScope } from "@/lib/api/workspace-scope";
import type { PageResponse, VoiceKnowledgeBase, VoiceKnowledgeFile } from "./types";

function kbKey() {
  const { orgId, projectId } = requireScope();
  return scopedKey("kb", `${orgId}:${projectId}`);
}
function filesKey(kbId: string) {
  return scopedKey("kb-files", kbId);
}

function pageOf<T>(items: T[], page = 1, pageSize = 50): PageResponse<T> {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { items: slice, page, page_size: pageSize, total: items.length, has_more: start + slice.length < items.length };
}

export async function listKnowledgeBases(params: { search?: string; page?: number; page_size?: number } = {}) {
  let items = readStore<VoiceKnowledgeBase[]>(kbKey(), []);
  const q = params.search?.trim().toLowerCase();
  if (q) items = items.filter((k) => k.name.toLowerCase().includes(q));
  return pageOf(items, params.page ?? 1, params.page_size ?? 50);
}

export async function getKnowledgeBase(kbId: string) {
  const row = readStore<VoiceKnowledgeBase[]>(kbKey(), []).find((k) => k.id === kbId);
  if (!row) throw new Error("Knowledge base not found");
  return row;
}

export async function createKnowledgeBase(input: { name: string; description?: string }) {
  const now = new Date().toISOString();
  const row: VoiceKnowledgeBase = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description ?? "",
    status: "ready",
    created_at: now,
    updated_at: now,
  };
  writeStore(kbKey(), [row, ...readStore<VoiceKnowledgeBase[]>(kbKey(), [])]);
  return row;
}

export async function updateKnowledgeBase(kbId: string, data: Partial<Pick<VoiceKnowledgeBase, "name" | "description">>) {
  const rows = readStore<VoiceKnowledgeBase[]>(kbKey(), []);
  const now = new Date().toISOString();
  const next = rows.map((k) => (k.id === kbId ? { ...k, ...data, updated_at: now } : k));
  writeStore(kbKey(), next);
  const row = next.find((k) => k.id === kbId);
  if (!row) throw new Error("Knowledge base not found");
  return row;
}

export async function deleteKnowledgeBase(kbId: string) {
  writeStore(
    kbKey(),
    readStore<VoiceKnowledgeBase[]>(kbKey(), []).filter((k) => k.id !== kbId),
  );
  writeStore(filesKey(kbId), []);
  return { success: true };
}

export async function listKnowledgeFiles(kbId: string, params: { page?: number; page_size?: number } = {}) {
  return pageOf(readStore<VoiceKnowledgeFile[]>(filesKey(kbId), []), params.page ?? 1, params.page_size ?? 50);
}

export async function uploadKnowledgeFile(kbId: string, file: File): Promise<VoiceKnowledgeFile> {
  const row: VoiceKnowledgeFile = {
    id: crypto.randomUUID(),
    kb_id: kbId,
    name: file.name,
    size_bytes: file.size,
    status: "ready",
    chunk_count: 0,
    created_at: new Date().toISOString(),
  };
  writeStore(filesKey(kbId), [row, ...readStore<VoiceKnowledgeFile[]>(filesKey(kbId), [])]);
  return row;
}

export async function deleteKnowledgeFile(kbId: string, fileId: string) {
  writeStore(
    filesKey(kbId),
    readStore<VoiceKnowledgeFile[]>(filesKey(kbId), []).filter((f) => f.id !== fileId),
  );
  return { success: true };
}

export async function searchKnowledgeBase(_kbId: string, _query: string, _topK = 5) {
  return [] as Array<{ id: string; file_id: string; content: string; similarity: number }>;
}
