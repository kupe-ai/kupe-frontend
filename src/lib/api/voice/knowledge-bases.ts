import { api } from "@/lib/api";
import { KoriApiError } from "@/lib/api/kori-errors";
import { requireScope } from "@/lib/api/workspace-scope";
import type { PageResponse, VoiceKnowledgeBase, VoiceKnowledgeFile } from "./types";

function requireKbId(kbId: string) {
  const id = kbId?.trim();
  if (!id) {
    throw new KoriApiError(400, "Knowledge base id is required");
  }
  return id;
}

function pageOf<T>(items: T[], total: number, page = 1, pageSize = 50): PageResponse<T> {
  return {
    items,
    page,
    page_size: pageSize,
    total,
    has_more: page * pageSize < total,
  };
}

function toKb(row: {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}): VoiceKnowledgeBase {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    status: (row.status as VoiceKnowledgeBase["status"]) || "ready",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toFile(row: {
  id: string;
  kb_id: string;
  name: string;
  size_bytes: number;
  status: string;
  chunk_count: number;
  created_at: string;
}): VoiceKnowledgeFile {
  return {
    id: row.id,
    kb_id: row.kb_id,
    name: row.name,
    size_bytes: row.size_bytes,
    status: (row.status as VoiceKnowledgeFile["status"]) || "queued",
    chunk_count: row.chunk_count,
    created_at: row.created_at,
  };
}

export async function listKnowledgeBases(params: { search?: string; page?: number; page_size?: number } = {}) {
  const { orgId, projectId } = requireScope();
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 50;
  const res = await api.listKnowledgeBases(orgId, projectId, {
    search: params.search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return pageOf(res.items.map(toKb), res.total, page, pageSize);
}

export async function getKnowledgeBase(kbId: string) {
  const { orgId, projectId } = requireScope();
  return toKb(await api.getKnowledgeBase(orgId, projectId, requireKbId(kbId)));
}

export async function createKnowledgeBase(input: { name: string; description?: string }) {
  const { orgId, projectId } = requireScope();
  return toKb(await api.createKnowledgeBase(orgId, projectId, input));
}

export async function updateKnowledgeBase(kbId: string, data: Partial<Pick<VoiceKnowledgeBase, "name" | "description">>) {
  const { orgId, projectId } = requireScope();
  return toKb(await api.patchKnowledgeBase(orgId, projectId, requireKbId(kbId), data));
}

export async function deleteKnowledgeBase(kbId: string) {
  const { orgId, projectId } = requireScope();
  return api.deleteKnowledgeBase(orgId, projectId, requireKbId(kbId));
}

export async function listKnowledgeFiles(kbId: string, params: { page?: number; page_size?: number } = {}) {
  const { orgId, projectId } = requireScope();
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 50;
  const res = await api.listKnowledgeFiles(orgId, projectId, requireKbId(kbId), {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return pageOf(res.items.map(toFile), res.total, page, pageSize);
}

export async function uploadKnowledgeFile(kbId: string, file: File): Promise<VoiceKnowledgeFile> {
  const { orgId, projectId } = requireScope();
  return toFile(await api.uploadKnowledgeFile(orgId, projectId, requireKbId(kbId), file));
}

export async function deleteKnowledgeFile(kbId: string, fileId: string) {
  const { orgId, projectId } = requireScope();
  const file = fileId?.trim();
  if (!file) {
    throw new KoriApiError(400, "Knowledge file id is required");
  }
  return api.deleteKnowledgeFile(orgId, projectId, requireKbId(kbId), file);
}

export async function searchKnowledgeBase(kbId: string, query: string, topK = 5) {
  const { orgId, projectId } = requireScope();
  const res = await api.searchKnowledgeBase(orgId, projectId, requireKbId(kbId), query, topK);
  return (res.chunks || []).map((c) => ({
    id: c.id,
    file_id: c.file_id,
    content: c.content,
    similarity: c.similarity,
  }));
}
