import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import { readStore, scopedKey, writeStore } from "@/lib/api/local-store";
import type { AgentConfig, PromptVariable } from "@/types";

export interface InputVariable {
  id: string;
  agent_id: string;
  name: string;
  default_value: string;
}

export interface OutputVariable {
  id: string;
  agent_id: string;
  name: string;
  data_type: "string" | "number" | "boolean" | "enum";
  extraction_prompt: string;
}

export interface CallGoal {
  id: string;
  agent_id: string;
  output_variable_id: string;
  field_operator: "eq" | "neq" | "in" | "not_in" | "gt";
  value: string;
}

export interface AgentTool {
  id: string;
  agent_id: string;
  kind: "custom_webhook" | "system_mcp";
  name: string;
  description: string;
  method?: string;
  url?: string;
  mcp_tool_name?: string;
  runs_on: "before_response" | "during_call" | "on_end";
  enabled: boolean;
}

export interface AgentTestCase {
  id: string;
  agent_id: string;
  name: string;
  scenario: string;
  behaviors: string[];
}

export interface AgentTestRun {
  id: string;
  agent_id: string;
  run_name: string | null;
  multiplier: number;
  status: "queued" | "running" | "completed" | "failed";
  results?: Array<{
    test_case_id: string;
    passed: boolean;
    behavior_results: Array<{ behavior: string; met: boolean; evidence: string }>;
    transcript_summary: string;
  }>;
}

export interface AgentSettings {
  speaking_speed?: number;
  pitch?: number;
  temperature_override?: number | null;
  knowledge_base_ids?: string[];
  allow_interruptions?: boolean;
  eagerness?: number;
  volume_threshold_db?: number;
  background_sound?: string;
  background_volume?: number;
  multilingual_enabled?: boolean;
  allowed_languages?: string[];
  auto_detect_language?: boolean;
  switch_after_seconds?: number | null;
  starting_language?: string;
  output_numbers_indic?: boolean;
  nudges?: Array<{ text: string; after_seconds: number }>;
  hangup_after_unanswered_nudges?: boolean;
  voicemail_enabled?: boolean;
  voicemail_message?: string | null;
  max_call_length_minutes?: number;
}

function extraKey(agentId: string, kind: string) {
  return scopedKey(`agent-${kind}`, agentId);
}

function readList<T>(agentId: string, kind: string): T[] {
  return readStore<T[]>(extraKey(agentId, kind), []);
}
function writeList<T>(agentId: string, kind: string, rows: T[]) {
  writeStore(extraKey(agentId, kind), rows);
}

export async function listInputVariables(agentId: string): Promise<InputVariable[]> {
  const agent = await api.getAgent(agentId);
  const vars = agent.config?.variables ?? [];
  return vars.map((v: PromptVariable, i) => ({
    id: `${agentId}-in-${v.key || i}`,
    agent_id: agentId,
    name: v.key,
    default_value: v.example ?? "",
  }));
}

export async function createInputVariable(agentId: string, data: Partial<InputVariable>) {
  const agent = await api.getAgent(agentId);
  const variables = [...(agent.config?.variables ?? [])];
  const key = data.name?.trim() || `var_${variables.length + 1}`;
  variables.push({ key, description: "", example: data.default_value ?? "" });
  await api.updateAgent(agentId, { config: { ...agent.config, variables } });
  return {
    id: `${agentId}-in-${key}`,
    agent_id: agentId,
    name: key,
    default_value: data.default_value ?? "",
  };
}

export async function updateInputVariable(agentId: string, id: string, data: Partial<InputVariable>) {
  const agent = await api.getAgent(agentId);
  const key = id.replace(`${agentId}-in-`, "");
  const variables = (agent.config?.variables ?? []).map((v) =>
    v.key === key
      ? { ...v, key: data.name ?? v.key, example: data.default_value ?? v.example }
      : v,
  );
  await api.updateAgent(agentId, { config: { ...agent.config, variables } });
  return {
    id,
    agent_id: agentId,
    name: data.name ?? key,
    default_value: data.default_value ?? "",
  };
}

export async function deleteInputVariable(agentId: string, id: string) {
  const agent = await api.getAgent(agentId);
  const key = id.replace(`${agentId}-in-`, "");
  const variables = (agent.config?.variables ?? []).filter((v) => v.key !== key);
  await api.updateAgent(agentId, { config: { ...agent.config, variables } });
}

export async function listOutputVariables(agentId: string) {
  return readList<OutputVariable>(agentId, "outputs");
}
export async function createOutputVariable(agentId: string, data: Partial<OutputVariable>) {
  const row: OutputVariable = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    name: data.name ?? "output",
    data_type: data.data_type ?? "string",
    extraction_prompt: data.extraction_prompt ?? "",
  };
  writeList(agentId, "outputs", [row, ...readList<OutputVariable>(agentId, "outputs")]);
  return row;
}
export async function updateOutputVariable(agentId: string, id: string, data: Partial<OutputVariable>) {
  const rows = readList<OutputVariable>(agentId, "outputs").map((r) => (r.id === id ? { ...r, ...data } : r));
  writeList(agentId, "outputs", rows);
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error("Output variable not found");
  return row;
}
export async function deleteOutputVariable(agentId: string, id: string) {
  writeList(
    agentId,
    "outputs",
    readList<OutputVariable>(agentId, "outputs").filter((r) => r.id !== id),
  );
}

export async function listCallGoals(agentId: string) {
  return readList<CallGoal>(agentId, "goals");
}
export async function createCallGoal(agentId: string, data: Partial<CallGoal>) {
  const row: CallGoal = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    output_variable_id: data.output_variable_id ?? "",
    field_operator: data.field_operator ?? "eq",
    value: data.value ?? "",
  };
  writeList(agentId, "goals", [row, ...readList<CallGoal>(agentId, "goals")]);
  return row;
}
export async function deleteCallGoal(agentId: string, id: string) {
  writeList(
    agentId,
    "goals",
    readList<CallGoal>(agentId, "goals").filter((r) => r.id !== id),
  );
}

export async function listAgentTools(agentId: string): Promise<AgentTool[]> {
  const page = await api.listAgentTools(agentId, { limit: 100 });
  return page.items.map((t) => ({
    id: t.id,
    agent_id: agentId,
    kind: "custom_webhook",
    name: t.name,
    description: t.description,
    method: t.http_method ?? "POST",
    url: t.http_url ?? undefined,
    runs_on: "during_call",
    enabled: t.enabled,
  }));
}

export async function createAgentTool(agentId: string, data: Partial<AgentTool>) {
  const { orgId } = requireScope();
  const tool = await api.createTool(orgId, {
    name: data.name ?? "New tool",
    description: data.description ?? "",
    http_url: data.url ?? null,
    http_method: data.method ?? "POST",
  });
  await api.attachAgentTool(agentId, tool.id, true);
  return {
    id: tool.id,
    agent_id: agentId,
    kind: "custom_webhook" as const,
    name: tool.name,
    description: tool.description,
    method: tool.http_method ?? "POST",
    url: tool.http_url ?? undefined,
    runs_on: "during_call" as const,
    enabled: true,
  };
}

export async function updateAgentTool(agentId: string, id: string, data: Partial<AgentTool>) {
  await api.updateTool(id, {
    name: data.name,
    description: data.description,
    http_url: data.url,
    http_method: data.method,
  });
  const tools = await listAgentTools(agentId);
  const row = tools.find((t) => t.id === id);
  if (!row) throw new Error("Tool not found");
  return { ...row, ...data };
}

export async function deleteAgentTool(agentId: string, id: string) {
  await api.detachAgentTool(agentId, id);
}

export async function listSystemTools(_agentId: string) {
  return [
    { name: "end_call", description: "Hang up when the conversation is complete." },
    { name: "transfer_call", description: "Warm-transfer to a destination from agent settings." },
    { name: "voicemail", description: "Leave a voicemail if the callee doesn't pick up." },
  ];
}

function settingsFromConfig(config: AgentConfig | undefined): AgentSettings {
  return {
    temperature_override: config?.llm.temperature,
    allow_interruptions: config?.session.allow_interruptions,
    background_sound: config?.audio.background_noise.enabled ? config.audio.background_noise.id : undefined,
    background_volume: config?.audio.background_noise.volume,
    voicemail_enabled: config?.voicemail_detection.enabled,
    voicemail_message: config?.voicemail_detection.message,
    max_call_length_minutes: config?.session.max_duration_seconds
      ? Math.round(config.session.max_duration_seconds / 60)
      : undefined,
    starting_language: config?.llm.language,
  };
}

export async function getAgentSettings(agentId: string): Promise<AgentSettings> {
  const agent = await api.getAgent(agentId);
  const extra = readStore<AgentSettings>(extraKey(agentId, "settings"), {});
  return { ...settingsFromConfig(agent.config), ...extra };
}

export async function updateAgentSettings(agentId: string, data: AgentSettings) {
  const agent = await api.getAgent(agentId);
  const config: AgentConfig = {
    ...agent.config,
    llm: {
      ...agent.config.llm,
      temperature: data.temperature_override ?? agent.config.llm.temperature,
      language: data.starting_language ?? agent.config.llm.language,
    },
    session: {
      ...agent.config.session,
      allow_interruptions: data.allow_interruptions ?? agent.config.session.allow_interruptions,
      max_duration_seconds: data.max_call_length_minutes
        ? data.max_call_length_minutes * 60
        : agent.config.session.max_duration_seconds,
    },
    voicemail_detection: {
      ...agent.config.voicemail_detection,
      enabled: data.voicemail_enabled ?? agent.config.voicemail_detection.enabled,
      message: data.voicemail_message ?? agent.config.voicemail_detection.message,
    },
  };
  await api.updateAgent(agentId, { config });
  writeStore(extraKey(agentId, "settings"), data);
  return data;
}

export async function listTestCases(agentId: string) {
  return readList<AgentTestCase>(agentId, "tests");
}
export async function createTestCase(agentId: string, data: Partial<AgentTestCase>) {
  const row: AgentTestCase = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    name: data.name ?? "New test",
    scenario: data.scenario ?? "",
    behaviors: data.behaviors ?? [],
  };
  writeList(agentId, "tests", [row, ...readList<AgentTestCase>(agentId, "tests")]);
  return row;
}
export async function updateTestCase(agentId: string, id: string, data: Partial<AgentTestCase>) {
  const rows = readList<AgentTestCase>(agentId, "tests").map((r) => (r.id === id ? { ...r, ...data } : r));
  writeList(agentId, "tests", rows);
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error("Test not found");
  return row;
}
export async function deleteTestCase(agentId: string, id: string) {
  writeList(
    agentId,
    "tests",
    readList<AgentTestCase>(agentId, "tests").filter((r) => r.id !== id),
  );
}

export async function runTestCase(agentId: string, testId: string, multiplier = 1, runName?: string) {
  const test = readList<AgentTestCase>(agentId, "tests").find((t) => t.id === testId);
  const run: AgentTestRun = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    run_name: runName ?? null,
    multiplier,
    status: "completed",
    results: test
      ? [
          {
            test_case_id: test.id,
            passed: true,
            behavior_results: test.behaviors.map((b) => ({
              behavior: b,
              met: true,
              evidence: "Local preview — automated eval is not wired yet.",
            })),
            transcript_summary: test.scenario || "No scenario provided.",
          },
        ]
      : [],
  };
  writeList(agentId, "test-runs", [run, ...readList<AgentTestRun>(agentId, "test-runs")]);
  return run;
}

export async function runAllTests(agentId: string, multiplier = 1, runName?: string) {
  const tests = readList<AgentTestCase>(agentId, "tests");
  const run: AgentTestRun = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    run_name: runName ?? null,
    multiplier,
    status: "completed",
    results: tests.map((t) => ({
      test_case_id: t.id,
      passed: true,
      behavior_results: t.behaviors.map((b) => ({
        behavior: b,
        met: true,
        evidence: "Local preview — automated eval is not wired yet.",
      })),
      transcript_summary: t.scenario || "No scenario provided.",
    })),
  };
  writeList(agentId, "test-runs", [run, ...readList<AgentTestRun>(agentId, "test-runs")]);
  return run;
}

export async function getTestRun(agentId: string, runId: string) {
  const run = readList<AgentTestRun>(agentId, "test-runs").find((r) => r.id === runId);
  if (!run) throw new Error("Test run not found");
  return run;
}

export async function copilotTurn(_agentId: string, message: string) {
  return {
    reply: `I can help shape this agent. You said: “${message.slice(0, 180)}”. Edit instructions on the left, then use Test agent to try a live call.`,
    actions: [] as string[],
  };
}
