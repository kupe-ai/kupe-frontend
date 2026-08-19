import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import { AGENT_TEMPLATES } from "@/lib/voice-agents-data";
import type { Agent } from "@/types";
import type { PageResponse, VoiceAgent, VoiceAgentTemplate } from "./types";

export interface CreateVoiceAgentInput {
  name?: string;
  first_message?: string;
  system_prompt?: string;
  template_id?: string;
  prompt?: string;
}

function toVoiceAgent(a: Agent): VoiceAgent {
  return {
    id: a.id,
    organization_id: a.org_id,
    workspace_id: a.project_id,
    name: a.name,
    email: null,
    avatar_seed: a.id,
    status: a.archived_at ? "archived" : "live",
    first_message: a.greeting,
    system_prompt: a.system_prompt,
    llm_provider_id: a.llm_id,
    tts_provider_id: a.tts_id,
    tts_voice_id: a.tts_voice_id,
    stt_provider_id: a.stt_id,
    temperature: a.config?.llm?.temperature ?? 0.7,
    languages: a.config?.llm?.language ? [a.config.llm.language] : ["en"],
    knowledge_base_id: null,
    current_version: a.version,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

function pageOf<T>(items: T[], page = 1, pageSize = 50): PageResponse<T> {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    page_size: pageSize,
    total: items.length,
    has_more: start + slice.length < items.length,
  };
}

export async function listVoiceAgents(params: { search?: string; page?: number; page_size?: number } = {}) {
  const { orgId, projectId } = requireScope();
  const res = await api.listAgents(orgId, projectId, { limit: 100 });
  let items = res.items.filter((a) => !a.archived_at).map(toVoiceAgent);
  const q = params.search?.trim().toLowerCase();
  if (q) items = items.filter((a) => a.name.toLowerCase().includes(q));
  return pageOf(items, params.page ?? 1, params.page_size ?? 50);
}

export async function getVoiceAgent(agentId: string) {
  return toVoiceAgent(await api.getAgent(agentId));
}

export async function createVoiceAgent(input: CreateVoiceAgentInput) {
  const { orgId, projectId } = requireScope();
  const tpl = input.template_id
    ? AGENT_TEMPLATES.find((t) => t.id === input.template_id)
    : undefined;
  const created = await api.createAgent(orgId, projectId, {
    name: input.name ?? tpl?.name ?? "New agent",
    system_prompt:
      input.system_prompt ??
      input.prompt ??
      tpl?.systemPrompt ??
      "",
    greeting: input.first_message ?? tpl?.firstMessage ?? null,
    config: tpl
      ? ({
          variables: tpl.variables.map((key) => ({ key, description: "", example: "" })),
        } as Agent["config"])
      : undefined,
  });
  return toVoiceAgent(created);
}

export async function updateVoiceAgent(agentId: string, input: Partial<VoiceAgent>) {
  const body: Partial<Agent> = {};
  if (input.name != null) body.name = input.name;
  if (input.system_prompt != null) body.system_prompt = input.system_prompt;
  if (input.first_message !== undefined) body.greeting = input.first_message;
  if (input.llm_provider_id != null) body.llm_id = input.llm_provider_id;
  if (input.stt_provider_id != null) body.stt_id = input.stt_provider_id;
  if (input.tts_provider_id != null) body.tts_id = input.tts_provider_id;
  if (input.tts_voice_id !== undefined) body.tts_voice_id = input.tts_voice_id;
  return toVoiceAgent(await api.updateAgent(agentId, body));
}

export async function deleteVoiceAgent(agentId: string) {
  await api.archiveAgent(agentId);
  return { success: true };
}

export async function duplicateVoiceAgent(agentId: string) {
  const src = await api.getAgent(agentId);
  const { orgId, projectId } = requireScope();
  const copy = await api.createAgent(orgId, projectId, {
    name: `${src.name} copy`,
    system_prompt: src.system_prompt,
    greeting: src.greeting,
    llm_id: src.llm_id,
    stt_id: src.stt_id,
    tts_id: src.tts_id,
    tts_voice_id: src.tts_voice_id,
    config: src.config,
  });
  return toVoiceAgent(copy);
}

export async function exportVoiceAgent(agentId: string) {
  return (await api.getAgent(agentId)) as unknown as Record<string, unknown>;
}

export async function commitVoiceAgentVersion(agentId: string, message?: string) {
  const agent = await api.commitAgent(agentId, message);
  return { id: agent.id, version: agent.version, message: message ?? null, created_at: agent.updated_at };
}

export async function listVoiceAgentVersions(agentId: string) {
  const page = await api.listAgentVersions(agentId, { limit: 50 });
  return page.items.map((v) => ({
    id: v.id != null ? String(v.id) : `${agentId}-v${v.version}`,
    version: v.version,
    label: v.changed_by,
    message: v.message ?? null,
    created_at: v.created_at,
    snapshot: v.snapshot,
  }));
}

export async function revertVoiceAgent(agentId: string, version: number) {
  return toVoiceAgent(await api.revertAgent(agentId, version));
}

export async function listVoiceAgentTemplates(category = "all"): Promise<VoiceAgentTemplate[]> {
  const rows = AGENT_TEMPLATES.filter((t) => category === "all" || t.category === category);
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    about: t.about,
    scenario: t.scenario,
    seed: t.seed,
    languages: t.languages,
    tools: t.tools,
    variables: t.variables,
    system_prompt: t.systemPrompt,
    first_message: t.firstMessage,
  }));
}
