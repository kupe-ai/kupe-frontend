import { readStore, scopedKey, writeStore } from "@/lib/api/local-store";
import { requireScope } from "@/lib/api/workspace-scope";

export interface VoiceInboundDeployment {
  id: string;
  name: string;
  agent_id: string;
  phone_number_id: string | null;
  status: "draft" | "active" | "paused";
  availability: Record<string, unknown>;
}

function key() {
  const { orgId, projectId } = requireScope();
  return scopedKey("inbound", `${orgId}:${projectId}`);
}

export async function listInboundDeployments() {
  return readStore<VoiceInboundDeployment[]>(key(), []);
}

export async function createInboundDeployment(data: {
  name: string;
  agent_id: string;
  agent_version?: number;
  phone_number_id?: string;
  phone_group?: string[];
  availability?: Record<string, unknown>;
}) {
  const row: VoiceInboundDeployment = {
    id: crypto.randomUUID(),
    name: data.name,
    agent_id: data.agent_id,
    phone_number_id: data.phone_number_id ?? null,
    status: "draft",
    availability: data.availability ?? {},
  };
  writeStore(key(), [row, ...readStore<VoiceInboundDeployment[]>(key(), [])]);
  return row;
}

export async function updateInboundDeployment(id: string, data: Partial<VoiceInboundDeployment>) {
  const rows = readStore<VoiceInboundDeployment[]>(key(), []);
  const next = rows.map((r) => (r.id === id ? { ...r, ...data } : r));
  writeStore(key(), next);
  const row = next.find((r) => r.id === id);
  if (!row) throw new Error("Inbound deployment not found");
  return row;
}

export async function deleteInboundDeployment(id: string) {
  writeStore(
    key(),
    readStore<VoiceInboundDeployment[]>(key(), []).filter((r) => r.id !== id),
  );
  return { success: true };
}

