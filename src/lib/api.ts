import { BACKEND_URL } from "../config";
import { supabase } from "./supabase";
import type {
  Agent,
  AgentAnalysis,
  AgentTool,
  AgentVersion,
  AnalysisResult,
  ApiKey,
  CatalogTool,
  CreateSessionBody,
  CreatedApiKey,
  Flow,
  Member,
  Membership,
  Organization,
  Page,
  PlaybackUrl,
  PostCallAnalysis,
  Project,
  Recording,
  SessionInfo,
  SessionUsage,
  TranscriptInfo,
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
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

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
  listOrgs: (params?: ListParams) => authedJson<Page<Organization>>(`/v1/orgs${qs(params)}`),
  createOrg: (name: string) =>
    authedJson<Organization>("/v1/orgs", { method: "POST", body: JSON.stringify({ name }) }),
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

  listFlows: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<Page<Flow>>(`/v1/orgs/${orgId}/projects/${projectId}/flows${qs(params)}`),
  createFlow: (orgId: string, projectId: string, body: Partial<Flow>) =>
    authedJson<Flow>(`/v1/orgs/${orgId}/projects/${projectId}/flows`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getFlow: (flowId: string) => authedJson<Flow>(`/v1/flows/${flowId}`),
  updateFlow: (flowId: string, body: Partial<Flow>) =>
    authedJson<Flow>(`/v1/flows/${flowId}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveFlow: (flowId: string) => authedJson<Flow>(`/v1/flows/${flowId}/archive`, { method: "POST" }),
};
