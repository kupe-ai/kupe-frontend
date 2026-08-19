import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import { readStore, scopedKey, writeStore } from "@/lib/api/local-store";
import { extractVariableNames } from "@/lib/prompt-variables";
import type {
  AgentConfig,
  AgentTest,
  AgentTestRun,
  AnalysisField,
  CallGoalConfig,
  CallTransferConfig,
  ExpectedToolCall,
  PromptVariable,
} from "@/types";

// Aliased for call-site continuity with the rest of this file/agent-tests-panel.tsx.
export type AgentTestCase = AgentTest;
export type { AgentTestRun, ExpectedToolCall };

export interface InputVariable {
  id: string;
  agent_id: string;
  name: string;
  default_value: string;
}

export interface OutputVariable {
  /** `${postCallAnalysisId}::${fieldName}` -- output variables are backed
   * for real by one AnalysisField inside the agent's attached
   * post-call-analysis (see ensureOutputVarsAnalysis below), not a
   * standalone table, so there's no independent row id. */
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
  parameters?: Record<string, unknown>;
  required?: string[];
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
  thinking_sounds?: boolean;
  auto_cut_enabled?: boolean;
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

/**
 * Adds an Input Variable row for every `{{name}}` token typed into the
 * prompt/first message that doesn't already have one, so the Variables tab
 * stays in sync with what's actually written in the prompt instead of
 * requiring a manual, easy-to-forget duplicate entry. Never removes or
 * edits existing rows (a variable can be declared but not yet used in
 * these two fields -- e.g. only in the flow or voicemail message).
 */
export async function syncDeclaredVariablesFromText(agentId: string, ...texts: (string | null | undefined)[]) {
  const names = extractVariableNames(...texts);
  if (!names.length) return;
  const agent = await api.getAgent(agentId);
  const existing = new Set((agent.config?.variables ?? []).map((v) => v.key));
  const missing = names.filter((n) => !existing.has(n));
  if (!missing.length) return;
  const variables = [
    ...(agent.config?.variables ?? []),
    ...missing.map((key) => ({ key, description: "", example: "" })),
  ];
  await api.updateAgent(agentId, { config: { ...agent.config, variables } });
}

// Output variables are real: each row is one AnalysisField inside a single
// post-call-analysis this agent owns and has attached (auto-provisioned on
// first write). That analysis actually runs at call end -- unlike the old
// localStorage-only version, values here are extracted from real calls and
// show up in call analysis results / webhooks, matching what Input
// Variables already do for prompts.
const OUTPUT_VARS_MARKER = "__kupe_agent_output_variables__";
const OUTPUT_VARS_PROMPT =
  "Extract the requested fields from this call's transcript and audio, for reporting and automation.";

function splitOutputVariableId(id: string): { analysisId: string; fieldName: string } {
  const sep = id.indexOf("::");
  if (sep < 0) throw new Error("Invalid output variable id");
  return { analysisId: id.slice(0, sep), fieldName: id.slice(sep + 2) };
}

async function findOutputVarsAnalysis(agentId: string) {
  const page = await api.listAgentAnalyses(agentId, { limit: 100 });
  return page.items.find((a) => a.description === OUTPUT_VARS_MARKER) ?? null;
}

async function ensureOutputVarsAnalysis(agentId: string) {
  const existing = await findOutputVarsAnalysis(agentId);
  if (existing) return existing;
  const { orgId } = requireScope();
  const agent = await api.getAgent(agentId);
  const created = await api.createAnalysis(orgId, {
    name: `${agent.name || "Agent"} — output variables`,
    description: OUTPUT_VARS_MARKER,
    prompt: OUTPUT_VARS_PROMPT,
    eval_llm_id: agent.llm_id,
    fields: [],
  });
  await api.attachAnalysis(agentId, created.id, true);
  return { ...created, enabled: true };
}

function toOutputVariable(agentId: string, analysisId: string, field: AnalysisField): OutputVariable {
  return {
    id: `${analysisId}::${field.name}`,
    agent_id: agentId,
    name: field.name,
    data_type: field.type,
    extraction_prompt: field.description,
  };
}

export async function listOutputVariables(agentId: string): Promise<OutputVariable[]> {
  const analysis = await findOutputVarsAnalysis(agentId);
  if (!analysis) return [];
  return analysis.fields.map((f) => toOutputVariable(agentId, analysis.id, f));
}

export async function createOutputVariable(agentId: string, data: Partial<OutputVariable>): Promise<OutputVariable> {
  const analysis = await ensureOutputVarsAnalysis(agentId);
  const name = data.name?.trim();
  if (!name) throw new Error("Name is required");
  if (analysis.fields.some((f) => f.name === name)) {
    throw new Error(`Output variable "${name}" already exists`);
  }
  const field: AnalysisField = { name, type: data.data_type ?? "string", description: data.extraction_prompt ?? "" };
  const fields = [...analysis.fields, field];
  await api.updateAnalysis(analysis.id, { fields });
  return toOutputVariable(agentId, analysis.id, field);
}

export async function updateOutputVariable(
  agentId: string,
  id: string,
  data: Partial<OutputVariable>,
): Promise<OutputVariable> {
  const { analysisId, fieldName } = splitOutputVariableId(id);
  const analysis = await findOutputVarsAnalysis(agentId);
  if (!analysis || analysis.id !== analysisId) throw new Error("Output variable not found");
  const newName = data.name?.trim() || fieldName;
  if (newName !== fieldName && analysis.fields.some((f) => f.name === newName)) {
    throw new Error(`Output variable "${newName}" already exists`);
  }
  let updatedField: AnalysisField | null = null;
  const fields = analysis.fields.map((f) => {
    if (f.name !== fieldName) return f;
    updatedField = {
      ...f,
      name: newName,
      type: data.data_type ?? f.type,
      description: data.extraction_prompt ?? f.description,
    };
    return updatedField;
  });
  if (!updatedField) throw new Error("Output variable not found");
  await api.updateAnalysis(analysisId, { fields });
  // Field renamed: keep the agent's call goal pointed at the right field.
  if (newName !== fieldName) {
    const agent = await api.getAgent(agentId);
    if (agent.config?.call_goal?.output_field === fieldName) {
      await api.updateAgent(agentId, {
        config: { ...agent.config, call_goal: { ...agent.config.call_goal, output_field: newName } },
      });
    }
  }
  return toOutputVariable(agentId, analysisId, updatedField);
}

export async function deleteOutputVariable(agentId: string, id: string): Promise<void> {
  const { analysisId, fieldName } = splitOutputVariableId(id);
  const analysis = await findOutputVarsAnalysis(agentId);
  if (!analysis || analysis.id !== analysisId) return;
  const fields = analysis.fields.filter((f) => f.name !== fieldName);
  await api.updateAnalysis(analysisId, { fields });
  const agent = await api.getAgent(agentId);
  if (agent.config?.call_goal?.output_field === fieldName) {
    await api.updateAgent(agentId, { config: { ...agent.config, call_goal: null } });
  }
}

// Call goal is one field on the agent's own config (real backend field --
// see CallGoalConfig in app/schemas/agent_config.py). At most one per
// agent, so list/create act like a singleton "slot" to match the panel's
// existing UI, which only ever edits activeGoal = goals[0].
export async function listCallGoals(agentId: string): Promise<CallGoal[]> {
  const [agent, outputs] = await Promise.all([api.getAgent(agentId), listOutputVariables(agentId)]);
  const goal = agent.config?.call_goal;
  if (!goal) return [];
  const matchingVar = outputs.find((v) => v.name === goal.output_field);
  return [
    {
      id: matchingVar?.id ?? goal.output_field,
      agent_id: agentId,
      output_variable_id: matchingVar?.id ?? goal.output_field,
      field_operator: goal.field_operator,
      value: goal.value,
    },
  ];
}

export async function createCallGoal(agentId: string, data: Partial<CallGoal>): Promise<CallGoal> {
  if (!data.output_variable_id) throw new Error("Pick an output variable for the call goal");
  const { fieldName } = splitOutputVariableId(data.output_variable_id);
  const agent = await api.getAgent(agentId);
  const call_goal: CallGoalConfig = {
    output_field: fieldName,
    field_operator: data.field_operator ?? "eq",
    value: data.value ?? "",
  };
  await api.updateAgent(agentId, { config: { ...agent.config, call_goal } });
  return {
    id: data.output_variable_id,
    agent_id: agentId,
    output_variable_id: data.output_variable_id,
    field_operator: call_goal.field_operator,
    value: call_goal.value,
  };
}

export async function deleteCallGoal(agentId: string, _id: string): Promise<void> {
  const agent = await api.getAgent(agentId);
  await api.updateAgent(agentId, { config: { ...agent.config, call_goal: null } });
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
    parameters: data.parameters ?? {},
    required: data.required ?? [],
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
    parameters: tool.parameters,
    required: tool.required,
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

// System tools (end_call, transfer_call, voicemail) are NOT rows in the
// custom-tools table -- they're toggles on the agent's own config
// (auto_cut / call_transfer / voicemail_detection, see
// app/schemas/agent_config.py). Read/write real per-agent state here
// instead of the old hardcoded stub that made "Enable" silently create a
// fake custom_webhook tool (the bug: system tools showing up under
// "Custom tools").
const SYSTEM_TOOL_DESCRIPTIONS: Record<SystemToolName, string> = {
  end_call: "Hang up when the conversation is complete.",
  transfer_call: "Warm-transfer to a destination configured below.",
  voicemail: "Leave a voicemail if the callee doesn't pick up (telephony only).",
};

export type SystemToolName = "end_call" | "transfer_call" | "voicemail";

export interface SystemTool {
  name: SystemToolName;
  description: string;
  enabled: boolean;
}

export async function listSystemTools(agentId: string): Promise<SystemTool[]> {
  const agent = await api.getAgent(agentId);
  const transferOk = await orgSupportsCallTransfer();
  const tools: SystemTool[] = [
    { name: "end_call", description: SYSTEM_TOOL_DESCRIPTIONS.end_call, enabled: agent.config.auto_cut.enabled },
    {
      name: "voicemail",
      description: SYSTEM_TOOL_DESCRIPTIONS.voicemail,
      enabled: agent.config.voicemail_detection.enabled,
    },
  ];
  if (transferOk) {
    tools.splice(1, 0, {
      name: "transfer_call",
      description: SYSTEM_TOOL_DESCRIPTIONS.transfer_call,
      enabled: agent.config.call_transfer.enabled,
    });
  }
  return tools;
}

export async function setSystemToolEnabled(agentId: string, name: SystemToolName, enabled: boolean): Promise<void> {
  const agent = await api.getAgent(agentId);
  const config: AgentConfig = { ...agent.config };
  if (name === "end_call") {
    config.auto_cut = { ...agent.config.auto_cut, enabled };
  } else if (name === "voicemail") {
    config.voicemail_detection = { ...agent.config.voicemail_detection, enabled };
  } else {
    if (enabled && agent.config.call_transfer.destinations.length === 0) {
      throw new Error("Add a transfer destination in Call Transfer settings before enabling this.");
    }
    config.call_transfer = { ...agent.config.call_transfer, enabled };
  }
  await api.updateAgent(agentId, { config });
}

function settingsFromConfig(config: AgentConfig | undefined): AgentSettings {
  const bg = config?.audio.background_noise;
  const nudges = (config?.silence_breaker.messages ?? []).map((m) => ({
    text: m.text,
    after_seconds: m.after_seconds,
  }));
  const bgId = bg?.enabled ? bg.id : "none";
  return {
    speaking_speed: config?.tts?.speaking_speed ?? 1.0,
    pitch: config?.tts?.pitch ?? 0,
    temperature_override: config?.llm.temperature,
    allow_interruptions: config?.session.allow_interruptions,
    eagerness: config?.turn.eagerness ?? 5,
    volume_threshold_db: config?.turn.volume_threshold_db ?? -30,
    background_sound: bgId === "office" ? "quiet-office" : bgId,
    background_volume: Math.round((bg?.volume ?? 0) * 100),
    voicemail_enabled: config?.voicemail_detection.enabled,
    voicemail_message: config?.voicemail_detection.message,
    max_call_length_minutes: config?.session.max_duration_seconds
      ? Math.round(config.session.max_duration_seconds / 60)
      : undefined,
    starting_language: config?.llm.language,
    allowed_languages: config?.llm.allowed_languages?.length
      ? config.llm.allowed_languages
      : config?.llm.language
        ? [config.llm.language]
        : ["en", "hi", "gu"],
    multilingual_enabled: config?.llm.multilingual_enabled,
    auto_detect_language: config?.llm.auto_detect_language,
    switch_after_seconds: config?.llm.switch_after_seconds ?? null,
    output_numbers_indic: config?.llm.output_numbers_indic,
    nudges,
    hangup_after_unanswered_nudges: config?.silence_breaker.hangup_after_unanswered ?? false,
    thinking_sounds: config?.thinking_sounds?.enabled ?? false,
    auto_cut_enabled: config?.auto_cut.enabled ?? false,
    knowledge_base_ids: config?.knowledge_base_ids ?? [],
  };
}

export async function getAgentSettings(agentId: string): Promise<AgentSettings> {
  const agent = await api.getAgent(agentId);
  return settingsFromConfig(agent.config);
}

function backgroundFromSettings(data: AgentSettings, fallback: AgentConfig["audio"]["background_noise"]) {
  const raw = data.background_sound ?? (fallback.enabled ? fallback.id : "none");
  const id = raw === "quiet-office" ? "office" : raw;
  const enabled = Boolean(id && id !== "none");
  const volumePct = data.background_volume;
  const volume =
    volumePct == null ? fallback.volume : Math.max(0, Math.min(1, volumePct > 1 ? volumePct / 100 : volumePct));
  return {
    enabled,
    source: "preset" as const,
    id: enabled ? id : fallback.id || "office",
    volume,
  };
}

export async function updateAgentSettings(agentId: string, data: AgentSettings) {
  const agent = await api.getAgent(agentId);
  const nudges = data.nudges ?? [];
  const config: AgentConfig = {
    ...agent.config,
    llm: {
      ...agent.config.llm,
      temperature: data.temperature_override ?? agent.config.llm.temperature,
      language: data.starting_language ?? agent.config.llm.language,
      allowed_languages: data.allowed_languages?.length
        ? data.allowed_languages
        : [data.starting_language ?? agent.config.llm.language ?? "hi"],
      multilingual_enabled: data.multilingual_enabled ?? agent.config.llm.multilingual_enabled ?? true,
      auto_detect_language: data.auto_detect_language ?? agent.config.llm.auto_detect_language ?? true,
      output_numbers_indic: data.output_numbers_indic ?? agent.config.llm.output_numbers_indic ?? false,
      switch_after_seconds:
        data.switch_after_seconds === undefined
          ? (agent.config.llm.switch_after_seconds ?? null)
          : data.switch_after_seconds,
    },
    tts: {
      speaking_speed: data.speaking_speed ?? agent.config.tts?.speaking_speed ?? 1.0,
      pitch: data.pitch ?? agent.config.tts?.pitch ?? 0,
    },
    session: {
      ...agent.config.session,
      allow_interruptions: data.allow_interruptions ?? agent.config.session.allow_interruptions,
      max_duration_seconds: data.max_call_length_minutes
        ? data.max_call_length_minutes * 60
        : agent.config.session.max_duration_seconds,
    },
    turn: {
      ...agent.config.turn,
      eagerness: data.eagerness ?? agent.config.turn.eagerness ?? 5,
      volume_threshold_db: data.volume_threshold_db ?? agent.config.turn.volume_threshold_db ?? -30,
    },
    audio: {
      ...agent.config.audio,
      background_noise: backgroundFromSettings(data, agent.config.audio.background_noise),
    },
    silence_breaker: {
      ...agent.config.silence_breaker,
      enabled: nudges.length > 0,
      idle_seconds: nudges[0]?.after_seconds || agent.config.silence_breaker.idle_seconds || 8,
      messages: nudges.map((n) => ({ text: n.text, after_seconds: n.after_seconds })),
      hangup_after_unanswered: data.hangup_after_unanswered_nudges ?? false,
    },
    thinking_sounds: {
      enabled: data.thinking_sounds ?? agent.config.thinking_sounds?.enabled ?? false,
    },
    knowledge_base_ids: data.knowledge_base_ids ?? agent.config.knowledge_base_ids ?? [],
    auto_cut: {
      ...agent.config.auto_cut,
      enabled: data.auto_cut_enabled ?? agent.config.auto_cut.enabled,
    },
    voicemail_detection: {
      ...agent.config.voicemail_detection,
      enabled: data.voicemail_enabled ?? agent.config.voicemail_detection.enabled,
      message: data.voicemail_message ?? agent.config.voicemail_detection.message,
    },
  };
  await api.updateAgent(agentId, { config });
  return data;
}

// Text-only (LLM simulation) agent tests + background test runs -- real
// backend-persisted endpoints (see kupe-backend app/routers/agent_tests.py),
// not the browser-local mock this used to be. A run never drives a real
// voice call or hits a real tool/webhook: the backend's AgentTestRunner
// intercepts tool calls in-process and grades the simulated transcript with
// an LLM judge.

export async function listTestCases(agentId: string) {
  const page = await api.listAgentTests(agentId, { limit: 100 });
  return page.items;
}
export async function createTestCase(
  agentId: string,
  data: { name?: string; scenario?: string; behaviors?: string[]; expected_tool_calls?: ExpectedToolCall[] },
) {
  return api.createAgentTest(agentId, {
    name: data.name ?? "New test",
    scenario: data.scenario ?? "",
    behaviors: data.behaviors ?? [],
    expected_tool_calls: data.expected_tool_calls ?? [],
  });
}
export async function updateTestCase(
  agentId: string,
  id: string,
  data: Partial<{ name: string; scenario: string; behaviors: string[]; expected_tool_calls: ExpectedToolCall[] }>,
) {
  return api.updateAgentTest(agentId, id, data);
}
export async function deleteTestCase(agentId: string, id: string) {
  await api.deleteAgentTest(agentId, id);
}

export async function runTestCase(agentId: string, testId: string, multiplier = 1, runName?: string) {
  return api.startAgentTestRun(agentId, { test_id: testId, multiplier, run_name: runName || null });
}

export async function runAllTests(agentId: string, multiplier = 1, runName?: string) {
  return api.startAgentTestRun(agentId, { multiplier, run_name: runName || null });
}

export async function listTestRuns(agentId: string) {
  const page = await api.listAgentTestRuns(agentId, { limit: 50 });
  return page.items;
}

export async function getTestRun(agentId: string, runId: string) {
  return api.getAgentTestRun(agentId, runId);
}

/**
 * Call transfer — reads/writes `AgentConfig.call_transfer` directly (real
 * backend field, same shape the LiveKit worker's `transfer_call` tool
 * consumes). Each destination's `numbers` list is dialed in order per
 * `ring_strategy`, so a second/third number acts as the fallback recipient
 * if the first doesn't pick up within `ring_timeout_seconds`.
 */
export async function orgSupportsCallTransfer(): Promise<boolean> {
  try {
    const { orgId } = requireScope();
    const accounts = await api.listTelephonyAccounts(orgId);
    if (!accounts.length) return true;
    return accounts.some((a) => a.provider === "twilio" || a.provider === "plivo");
  } catch {
    return true;
  }
}

export async function getCallTransferConfig(agentId: string): Promise<CallTransferConfig> {
  const agent = await api.getAgent(agentId);
  return agent.config?.call_transfer ?? { enabled: false, destinations: [] };
}

export async function updateCallTransferConfig(
  agentId: string,
  callTransfer: CallTransferConfig,
): Promise<CallTransferConfig> {
  const agent = await api.getAgent(agentId);
  await api.updateAgent(agentId, {
    config: { ...agent.config, call_transfer: callTransfer },
  });
  return callTransfer;
}

export async function copilotTurn(_agentId: string, message: string) {
  return {
    reply: `I can help shape this agent. You said: “${message.slice(0, 180)}”. Edit instructions on the left, then use Test agent to try a live call.`,
    actions: [] as string[],
  };
}
