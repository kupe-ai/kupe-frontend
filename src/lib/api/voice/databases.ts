import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type {
  AnalysisField,
  CallDatabase,
  CallDatabaseAgent,
  CallDatabaseRow,
  DatabaseDestination,
} from "@/types";

export async function listCallDatabases(params: { search?: string; page?: number; page_size?: number } = {}) {
  const { orgId, projectId } = requireScope();
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const res = await api.listDatabases(orgId, projectId, {
    search: params.search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return {
    items: res.items,
    page,
    page_size: pageSize,
    total: res.total,
    has_more: page * pageSize < res.total,
  };
}

export async function createCallDatabase(input: { name: string; description?: string; fields?: AnalysisField[] }) {
  const { orgId, projectId } = requireScope();
  return api.createDatabase(orgId, projectId, input);
}

export function getCallDatabase(id: string) {
  return api.getDatabase(id);
}

export function patchCallDatabase(
  id: string,
  body: {
    name?: string;
    description?: string;
    fields?: AnalysisField[];
    destinations?: DatabaseDestination[];
  },
) {
  return api.patchDatabase(id, body);
}

export function archiveCallDatabase(id: string) {
  return api.archiveDatabase(id);
}

export function listCallDatabaseAgents(id: string) {
  return api.listDatabaseAgents(id);
}

export function attachCallDatabaseAgent(id: string, agentId: string) {
  return api.attachDatabaseAgent(id, agentId, true);
}

export function detachCallDatabaseAgent(id: string, agentId: string) {
  return api.detachDatabaseAgent(id, agentId);
}

export function listCallDatabaseRows(
  id: string,
  params?: { cursor?: string; limit?: number; q?: string },
) {
  return api.listDatabaseRows(id, params);
}

export function exportCallDatabase(id: string, format: "csv" | "json" | "ndjson" | "zip", q?: string) {
  return api.exportDatabase(id, format, q);
}

export function listAgentCallDatabases(agentId: string) {
  return api.listAgentDatabases(agentId);
}

export type { CallDatabase, CallDatabaseAgent, CallDatabaseRow, DatabaseDestination, AnalysisField };
