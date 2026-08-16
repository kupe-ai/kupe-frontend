import { BACKEND_URL } from "../config";
import { supabase } from "./supabase";
import type {
  Agent,
  AgentAnalysis,
  AgentTool,
  AgentVersion,
  AnalysisResult,
  ApiKey,
  AudioAsset,
  AudioAssetList,
  Batch,
  BatchContact,
  BatchCreateBody,
  BatchSchedule,
  BatchStats,
  CatalogTool,
  CatalogVoice,
  CreateSessionBody,
  CreatedApiKey,
  Member,
  Membership,
  Organization,
  Page,
  PlaybackUrl,
  PostCallAnalysis,
  Project,
  RateLimitConfig,
  Recording,
  SessionInfo,
  SessionUsage,
  TelephonyAccount,
  TelephonyAccountBody,
  TranscriptInfo,
  UsageDailyRow,
  UsageSummaryRow,
} from "../types";

export type ListParams = { limit?: number; offset?: number };

function qs(params?: ListParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Every CRUD call goes through this -- attaches the current Supabase JWT
 * (if any) as a Bearer token, same shared-fetch pattern for every endpoint
 * instead of each call site reimplementing headers/error handling.
 */
async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // FormData sets its own multipart boundary — never force JSON on it.
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      `Cannot reach API at ${BACKEND_URL} — is kupe-backend running (uvicorn on :8000)?`,
    );
  }
}

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Backend returned ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listVoices: (providerId: string) =>
    authedJson<{ items: CatalogVoice[] }>(`/v1/voices?provider_id=${encodeURIComponent(providerId)}`),
  cloneVoice: (data: { name: string; isPublic: boolean; sample: File }) => {
    const form = new FormData();
    form.set("name", data.name);
    form.set("is_public", String(data.isPublic));
    form.set("sample", data.sample);
    return authedJson<CatalogVoice>("/v1/voices/clone", { method: "POST", body: form });
  },
  updateVoice: (voiceId: string, data: { name?: string; isPublic?: boolean }) => {
    const form = new FormData();
    if (data.name != null) form.set("name", data.name);
    if (data.isPublic != null) form.set("is_public", String(data.isPublic));
    return authedJson<CatalogVoice>(`/v1/voices/${voiceId}`, { method: "PATCH", body: form });
  },
  deleteVoice: (voiceId: string) =>
    authedJson<void>(`/v1/voices/${voiceId}`, { method: "DELETE" }),
  speakVoice: async (voiceId: string, data: { text: string; language?: string }): Promise<Blob> => {
    const res = await authedFetch(`/v1/voices/${voiceId}/speak`, {
      method: "POST",
      body: JSON.stringify({ text: data.text, language: data.language ?? "en" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Backend returned ${res.status}`);
    }
    return res.blob();
  },
  listOrgs: (params?: ListParams) => authedJson<Page<Organization>>(`/v1/orgs${qs(params)}`),
  createOrg: (name: string) =>
    authedJson<Organization>("/v1/orgs", { method: "POST", body: JSON.stringify({ name }) }),
  updateOrgCountry: (orgId: string, country: string) =>
    authedJson<Organization>(`/v1/orgs/${orgId}`, { method: "PATCH", body: JSON.stringify({ country }) }),
  getMembership: (orgId: string) => authedJson<Membership>(`/v1/orgs/${orgId}/members/me`),
  listMembers: (orgId: string, params?: ListParams) =>
    authedJson<Page<Member>>(`/v1/orgs/${orgId}/members${qs(params)}`),
  addMember: (orgId: string, body: { email: string; role: string; project_ids?: string[] }) =>
    authedJson<Member>(`/v1/orgs/${orgId}/members`, { method: "POST", body: JSON.stringify(body) }),
  updateMember: (orgId: string, userId: string, body: { role: string; project_ids?: string[] }) =>
    authedJson<Member>(`/v1/orgs/${orgId}/members/${userId}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeMember: (orgId: string, userId: string) =>
    authedJson<{ status: string }>(`/v1/orgs/${orgId}/members/${userId}`, { method: "DELETE" }),
  listProjects: (orgId: string, params?: ListParams) =>
    authedJson<Page<Project>>(`/v1/orgs/${orgId}/projects${qs(params)}`),
  createProject: (orgId: string, name: string) =>
    authedJson<Project>(`/v1/orgs/${orgId}/projects`, { method: "POST", body: JSON.stringify({ name }) }),
  archiveProject: (projectId: string) =>
    authedJson<Project>(`/v1/projects/${projectId}/archive`, { method: "POST" }),
  listApiKeys: (projectId: string, params?: ListParams) =>
    authedJson<Page<ApiKey>>(`/v1/projects/${projectId}/api-keys${qs(params)}`),
  createApiKey: (projectId: string, name: string) =>
    authedJson<CreatedApiKey>(`/v1/projects/${projectId}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  revokeApiKey: (projectId: string, keyId: string) =>
    authedJson<ApiKey>(`/v1/projects/${projectId}/api-keys/${keyId}`, { method: "DELETE" }),
  createSession: (body: CreateSessionBody) =>
    authedJson<SessionInfo>("/v1/sessions", { method: "POST", body: JSON.stringify(body) }),
  endSession: (sessionId: string) => authedJson<SessionInfo>(`/v1/sessions/${sessionId}/end`, { method: "POST" }),
  listSessions: (orgId: string, params?: ListParams) =>
    authedJson<Page<SessionInfo>>(`/v1/orgs/${orgId}/sessions${qs(params)}`),

  usageSummary: (orgId: string, params?: ListParams) =>
    authedJson<Page<UsageSummaryRow>>(`/v1/orgs/${orgId}/usage${qs(params)}`),
  listSessionUsage: (orgId: string, params?: ListParams) =>
    authedJson<Page<SessionUsage>>(`/v1/orgs/${orgId}/usage/sessions${qs(params)}`),
  getSessionUsage: (sessionId: string) => authedJson<SessionUsage>(`/v1/sessions/${sessionId}/usage`),
  dailyUsage: (orgId: string, params: { startDate: string; endDate: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams({ start_date: params.startDate, end_date: params.endDate });
    if (params.limit != null) sp.set("limit", String(params.limit));
    if (params.offset != null) sp.set("offset", String(params.offset));
    return authedJson<Page<UsageDailyRow>>(`/v1/orgs/${orgId}/usage/daily?${sp.toString()}`);
  },

  getRecording: (sessionId: string) => authedJson<Recording>(`/v1/sessions/${sessionId}/recording`),
  listRecordings: (orgId: string, params?: ListParams) =>
    authedJson<Page<Recording>>(`/v1/orgs/${orgId}/recordings${qs(params)}`),
  getPlaybackUrl: (recordingId: string) =>
    authedJson<PlaybackUrl>(`/v1/recordings/${recordingId}/playback-url`),

  // Agents
  listAgents: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<Page<Agent>>(`/v1/orgs/${orgId}/projects/${projectId}/agents${qs(params)}`),
  getAgent: (agentId: string) => authedJson<Agent>(`/v1/agents/${agentId}`),
  createAgent: (orgId: string, projectId: string, body: Partial<Agent>) =>
    authedJson<Agent>(`/v1/orgs/${orgId}/projects/${projectId}/agents`, { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (agentId: string, body: Partial<Agent>) =>
    authedJson<Agent>(`/v1/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveAgent: (agentId: string) => authedJson<Agent>(`/v1/agents/${agentId}/archive`, { method: "POST" }),
  listAgentVersions: (agentId: string, params?: ListParams) =>
    authedJson<Page<AgentVersion>>(`/v1/agents/${agentId}/versions${qs(params)}`),
  revertAgent: (agentId: string, version: number) =>
    authedJson<Agent>(`/v1/agents/${agentId}/revert/${version}`, { method: "POST" }),
  attachAnalysis: (agentId: string, postCallAnalysisId: string, enabled = true) =>
    authedJson(`/v1/agents/${agentId}/post-call-analyses`, {
      method: "POST",
      body: JSON.stringify({ post_call_analysis_id: postCallAnalysisId, enabled }),
    }),
  detachAnalysis: (agentId: string, analysisId: string) =>
    authedJson(`/v1/agents/${agentId}/post-call-analyses/${analysisId}`, { method: "DELETE" }),
  listAgentAnalyses: (agentId: string, params?: ListParams) =>
    authedJson<Page<AgentAnalysis>>(`/v1/agents/${agentId}/post-call-analyses${qs(params)}`),

  // Post-call analyses
  listAnalyses: (orgId: string, params?: ListParams) =>
    authedJson<Page<PostCallAnalysis>>(`/v1/orgs/${orgId}/post-call-analyses${qs(params)}`),
  createAnalysis: (orgId: string, body: Partial<PostCallAnalysis>) =>
    authedJson<PostCallAnalysis>(`/v1/orgs/${orgId}/post-call-analyses`, { method: "POST", body: JSON.stringify(body) }),
  updateAnalysis: (analysisId: string, body: Partial<PostCallAnalysis>) =>
    authedJson<PostCallAnalysis>(`/v1/post-call-analyses/${analysisId}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveAnalysis: (analysisId: string) =>
    authedJson<PostCallAnalysis>(`/v1/post-call-analyses/${analysisId}/archive`, { method: "POST" }),

  // Transcript + analysis results
  getTranscript: (sessionId: string) => authedJson<TranscriptInfo>(`/v1/sessions/${sessionId}/transcript`),
  getAnalysisResults: (sessionId: string, params?: ListParams) =>
    authedJson<Page<AnalysisResult>>(`/v1/sessions/${sessionId}/analysis${qs(params)}`),

  listTools: (orgId: string, params?: ListParams) =>
    authedJson<Page<CatalogTool>>(`/v1/orgs/${orgId}/tools${qs(params)}`),
  createTool: (orgId: string, body: Partial<CatalogTool> & { http_headers?: Record<string, string> }) =>
    authedJson<CatalogTool>(`/v1/orgs/${orgId}/tools`, { method: "POST", body: JSON.stringify(body) }),
  updateTool: (toolId: string, body: Partial<CatalogTool> & { http_headers?: Record<string, string> }) =>
    authedJson<CatalogTool>(`/v1/tools/${toolId}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveTool: (toolId: string) => authedJson<CatalogTool>(`/v1/tools/${toolId}/archive`, { method: "POST" }),
  listAgentTools: (agentId: string, params?: ListParams) =>
    authedJson<Page<AgentTool>>(`/v1/agents/${agentId}/tools${qs(params)}`),
  attachAgentTool: (agentId: string, toolId: string, enabled = true) =>
    authedJson(`/v1/agents/${agentId}/tools`, { method: "POST", body: JSON.stringify({ tool_id: toolId, enabled }) }),
  detachAgentTool: (agentId: string, toolId: string) =>
    authedJson(`/v1/agents/${agentId}/tools/${toolId}`, { method: "DELETE" }),
  listAnalysisTools: (analysisId: string, params?: ListParams) =>
    authedJson<Page<AgentTool>>(`/v1/post-call-analyses/${analysisId}/tools${qs(params)}`),
  attachAnalysisTool: (analysisId: string, toolId: string, enabled = true) =>
    authedJson(`/v1/post-call-analyses/${analysisId}/tools`, {
      method: "POST",
      body: JSON.stringify({ tool_id: toolId, enabled }),
    }),
  detachAnalysisTool: (analysisId: string, toolId: string) =>
    authedJson(`/v1/post-call-analyses/${analysisId}/tools/${toolId}`, { method: "DELETE" }),

  listAudioAssets: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<AudioAssetList>(`/v1/orgs/${orgId}/projects/${projectId}/audio-assets${qs(params)}`),
  uploadAudioAsset: async (orgId: string, projectId: string, name: string, file: File) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${BACKEND_URL}/v1/orgs/${orgId}/projects/${projectId}/audio-assets`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed (${res.status})`);
    }
    return (await res.json()) as AudioAsset;
  },
  archiveAudioAsset: (assetId: string) =>
    authedJson<AudioAsset>(`/v1/audio-assets/${assetId}/archive`, { method: "POST" }),

  // Telephony accounts
  listTelephonyAccounts: (orgId: string) =>
    authedJson<TelephonyAccount[]>(`/v1/orgs/${orgId}/telephony-accounts`),
  createTelephonyAccount: (orgId: string, body: TelephonyAccountBody) =>
    authedJson<TelephonyAccount>(`/v1/orgs/${orgId}/telephony-accounts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteTelephonyAccount: (accountId: string) =>
    authedJson<void>(`/v1/telephony-accounts/${accountId}`, { method: "DELETE" }),

  listRateLimitConfigs: (orgId?: string) =>
    authedJson<RateLimitConfig[]>(`/v1/rate-limit-configs${orgId ? `?org_id=${orgId}` : ""}`),
  upsertRateLimitConfig: (body: Partial<RateLimitConfig> & { scope: string }) =>
    authedJson<RateLimitConfig>("/v1/rate-limit-configs", { method: "POST", body: JSON.stringify(body) }),
  deleteRateLimitConfig: (configId: string) =>
    authedJson<void>(`/v1/rate-limit-configs/${configId}`, { method: "DELETE" }),

  // Batches
  listBatches: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<Page<Batch>>(`/v1/orgs/${orgId}/projects/${projectId}/batches${qs(params)}`),
  createBatch: (body: BatchCreateBody) =>
    authedJson<Batch>("/v1/batches", { method: "POST", body: JSON.stringify(body) }),
  getBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}`),
  getBatchStats: (batchId: string) => authedJson<BatchStats>(`/v1/batches/${batchId}/stats`),
  listBatchContacts: (batchId: string, params?: ListParams) =>
    authedJson<Page<BatchContact>>(`/v1/batches/${batchId}/contacts${qs(params)}`),
  addBatchContactsBulk: (batchId: string, contacts: { phone_number: string; variables?: Record<string, unknown> }[]) =>
    authedJson<BatchContact[]>(`/v1/batches/${batchId}/contacts:bulk`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    }),
  uploadBatchContactsCsv: async (batchId: string, file: File) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const form = new FormData();
    form.append("file", file);
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${BACKEND_URL}/v1/batches/${batchId}/contacts`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed (${res.status})`);
    }
    return (await res.json()) as BatchContact[];
  },
  startBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/start`, { method: "POST" }),
  pauseBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/pause`, { method: "POST" }),
  resumeBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/resume`, { method: "POST" }),
  cancelBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/cancel`, { method: "POST" }),
  updateBatchSchedule: (batchId: string, schedule: BatchSchedule) =>
    authedJson<Batch>(`/v1/batches/${batchId}/schedule`, { method: "PATCH", body: JSON.stringify(schedule) }),
};
