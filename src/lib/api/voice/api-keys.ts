import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { VoiceApiKey } from "./types";

export async function listVoiceApiKeys(): Promise<VoiceApiKey[]> {
  const { projectId } = requireScope();
  const page = await api.listApiKeys(projectId, { limit: 100 });
  return page.items.map((k) => ({
    id: k.id,
    name: k.name,
    key_prefix: k.key_prefix,
    created_at: k.created_at,
    last_used_at: k.last_used_at,
  }));
}

export async function createVoiceApiKey(name: string): Promise<VoiceApiKey> {
  const { projectId } = requireScope();
  const created = await api.createApiKey(projectId, name);
  return {
    id: created.id,
    name: created.name,
    key_prefix: created.key_prefix,
    created_at: created.created_at,
    last_used_at: created.last_used_at,
    key: created.api_key,
  };
}

export async function revokeVoiceApiKey(id: string) {
  const { projectId } = requireScope();
  await api.revokeApiKey(projectId, id);
  return { success: true };
}
