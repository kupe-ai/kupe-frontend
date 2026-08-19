import { BACKEND_URL } from "../config";
import { supabase } from "./supabase";
import { NETWORK_UNREACHABLE, isAbortError, isBrowserNetworkError } from "./network-error";
import { captureEvent, captureException } from "./posthog";
import { isConcurrencyLimitError } from "./voice/concurrency-limit";
import type {
  Agent,
  AgentAnalysis,
  AgentTest,
  AgentTestRun,
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
  CampaignCallAnalytics,
  CampaignOutcomeRow,
  CatalogTool,
  CatalogVoice,
  ComposioConnectOut,
  ComposioConnection,
  ComposioToolkitsPage,
  ComposioToolsPage,
  CreateSessionBody,
  CreatedApiKey,
  InboundCreateBody,
  InboundDeployment,
  InboundPatchBody,
  Member,
  Membership,
  Organization,
  OrgAccess,
  MemberAccess,
  FeatureFlags,
  Page,
  PlaybackUrl,
  PlivoComplianceApplication,
  PlivoComplianceRequirementsOut,
  PlivoComplianceSubmitBody,
  PlivoNumberSearchOut,
  PlivoPurchaseBody,
  PostCallAnalysis,
  Project,
  RateLimitConfig,
  Recording,
  RecipientList,
  RecipientListMember,
  RecipientMembersPage,
  MemberInsertResult,
  AttachListResult,
  CursorContactsPage,
  SessionInfo,
  SessionUsage,
  StandaloneUsageRow,
  TelephonyAccount,
  TelephonyAccountBody,
  TelephonyAccountPatchBody,
  ToolCallEvent,
  ToolCallStatsRow,
  TranscriptInfo,
  UsageCostSummary,
  UsageDailyRow,
  UsageSummaryRow,
  Wallet,
  Invoice,
  BillingPlan,
  TopupOrder,
  TopupVerifyResult,
  SubscriptionAction,
  BillingSubscription,
  KnowledgeBase,
  KnowledgeFile,
} from "../types";

export type ListParams = { limit?: number; offset?: number; name?: string };
export type DisplayCurrency = "USD" | "INR";

function qs(params?: ListParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  if (params.name) sp.set("name", params.name);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function usageQuery(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  currency?: string;
}): string {
  const sp = new URLSearchParams();
  if (params?.startDate) sp.set("start_date", params.startDate);
  if (params?.endDate) sp.set("end_date", params.endDate);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.currency) sp.set("currency", params.currency);
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
  } catch (err) {
    if (!isAbortError(err) && !isBrowserNetworkError(err)) {
      captureException(err, { source: "api.network", path, method: init?.method ?? "GET" });
    }
    throw new Error(NETWORK_UNREACHABLE, { cause: err });
  }
}

async function throwIfNotOk(res: Response, path: string, method: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  const detail = (body as { detail?: unknown }).detail;
  const message =
    typeof detail === "string" ? detail : detail != null ? JSON.stringify(detail) : `Backend returned ${res.status}`;
  const err = new Error(message);
  // Expected client errors (auth, missing, validation, conflicts, rate limits)
  // are not product bugs. Concurrent-call caps are a user-facing warning.
  if (isConcurrencyLimitError(err)) {
    captureEvent("concurrency_limit_reached", {
      level: "warning",
      source: "api.http",
      path,
      method,
      status: res.status,
      message,
    });
  } else if (![400, 401, 403, 404, 409, 422, 429].includes(res.status)) {
    captureException(err, { source: "api.http", path, method, status: res.status });
  }
  throw err;
}

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  await throwIfNotOk(res, path, init?.method ?? "GET");
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listVoices: (provider?: string) => {
    if (!provider) return authedJson<{ items: CatalogVoice[] }>("/v1/voices");
    const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      provider,
    );
    const q = looksLikeId
      ? `provider_id=${encodeURIComponent(provider)}`
      : `provider=${encodeURIComponent(provider)}`;
    return authedJson<{ items: CatalogVoice[] }>(`/v1/voices?${q}`);
  },
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
  speakVoice: async (
    voiceId: string,
    data: { text: string; language?: string; orgId: string; speed?: number; pitch?: number },
  ): Promise<Blob> => {
    const res = await authedFetch(`/v1/voices/${voiceId}/speak`, {
      method: "POST",
      body: JSON.stringify({
        text: data.text,
        language: data.language ?? "en",
        org_id: data.orgId,
        speed: data.speed,
        pitch: data.pitch,
      }),
    });
    if (!res.ok) {
      await throwIfNotOk(res, `/v1/voices/${voiceId}/speak`, "POST");
    }
    return res.blob();
  },
  getVoicePreview: async (voiceId: string): Promise<Blob> => {
    const res = await authedFetch(`/v1/voices/${voiceId}/preview`);
    if (!res.ok) {
      await throwIfNotOk(res, `/v1/voices/${voiceId}/preview`, "GET");
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
  getFeatureFlags: (orgId?: string | null) => {
    const q = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
    return authedJson<FeatureFlags>(`/v1/feature-flags${q}`);
  },
  getOrgAccess: (orgId: string) => authedJson<OrgAccess>(`/v1/orgs/${orgId}/access`),
  patchOrgAccess: (orgId: string, body: { restricted?: boolean; flags?: Record<string, boolean> }) =>
    authedJson<OrgAccess>(`/v1/orgs/${orgId}/access`, { method: "PATCH", body: JSON.stringify(body) }),
  patchMemberAccess: (
    orgId: string,
    userId: string,
    body: { restricted?: boolean; flags?: Record<string, boolean> },
  ) =>
    authedJson<MemberAccess>(`/v1/orgs/${orgId}/members/${userId}/access`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
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
  getSession: (sessionId: string) => authedJson<SessionInfo>(`/v1/sessions/${sessionId}`),
  endSession: (sessionId: string) => authedJson<SessionInfo>(`/v1/sessions/${sessionId}/end`, { method: "POST" }),
  listSessions: (orgId: string, params?: ListParams) =>
    authedJson<Page<SessionInfo>>(`/v1/orgs/${orgId}/sessions${qs(params)}`),

  usageSummary: (orgId: string, params?: ListParams) =>
    authedJson<Page<UsageSummaryRow>>(`/v1/orgs/${orgId}/usage${qs(params)}`),
  usageCostSummary: (orgId: string, params?: { startDate?: string; endDate?: string; currency?: string }) =>
    authedJson<UsageCostSummary>(`/v1/orgs/${orgId}/usage/cost-summary${usageQuery(params)}`),
  listSessionUsage: (
    orgId: string,
    params?: ListParams & { startDate?: string; endDate?: string; currency?: string },
  ) => authedJson<Page<SessionUsage>>(`/v1/orgs/${orgId}/usage/sessions${usageQuery(params)}`),
  getSessionUsage: (sessionId: string, params?: { currency?: string }) =>
    authedJson<SessionUsage>(`/v1/sessions/${sessionId}/usage${usageQuery(params)}`),
  listStandaloneUsage: (
    orgId: string,
    params?: ListParams & { startDate?: string; endDate?: string; currency?: string },
  ) => authedJson<Page<StandaloneUsageRow>>(`/v1/orgs/${orgId}/usage/standalone${usageQuery(params)}`),
  dailyUsage: (
    orgId: string,
    params: { startDate: string; endDate: string; limit?: number; offset?: number; currency?: string },
  ) => authedJson<Page<UsageDailyRow>>(`/v1/orgs/${orgId}/usage/daily${usageQuery(params)}`),
  getWallet: (orgId: string, params?: { currency?: string }) =>
    authedJson<Wallet>(`/v1/orgs/${orgId}/billing/wallet${usageQuery(params)}`),
  listInvoices: (orgId: string, params?: ListParams & { currency?: string }) =>
    authedJson<Page<Invoice>>(`/v1/orgs/${orgId}/billing/invoices${usageQuery(params)}`),
  downloadInvoicePdf: async (orgId: string, invoiceId: string, invoiceNumber: string) => {
    const res = await authedFetch(`/v1/orgs/${orgId}/billing/invoices/${invoiceId}/pdf`);
    if (!res.ok) {
      await throwIfNotOk(res, `/v1/orgs/${orgId}/billing/invoices/${invoiceId}/pdf`, "GET");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber || "invoice"}.pdf`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  },
  getBillingConfig: () => authedJson<{ key_id: string }>("/v1/billing/config"),
  getPlans: (params?: { currency?: string }) =>
    authedJson<BillingPlan[]>(`/v1/billing/plans${usageQuery(params)}`),
  getBillingSubscription: (orgId: string) =>
    authedJson<BillingSubscription>(`/v1/orgs/${orgId}/billing/subscription`),
  createTopupOrder: (orgId: string, amountMinorUnits: number, planCode = "payg") =>
    authedJson<TopupOrder>(`/v1/orgs/${orgId}/billing/topup`, {
      method: "POST",
      body: JSON.stringify({ amount_minor_units: amountMinorUnits, plan_code: planCode }),
    }),
  verifyTopupPayment: (
    orgId: string,
    body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) =>
    authedJson<TopupVerifyResult>(`/v1/orgs/${orgId}/billing/topup/verify`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createSubscription: (orgId: string, planCode: string) =>
    authedJson<SubscriptionAction>(`/v1/orgs/${orgId}/billing/subscribe`, {
      method: "POST",
      body: JSON.stringify({ plan_code: planCode }),
    }),
  changeSubscription: (orgId: string, planCode: string) =>
    authedJson<SubscriptionAction>(`/v1/orgs/${orgId}/billing/subscribe/change`, {
      method: "POST",
      body: JSON.stringify({ plan_code: planCode }),
    }),
  setBillingOverages: (orgId: string, enabled: boolean) =>
    authedJson<BillingSubscription>(`/v1/orgs/${orgId}/billing/subscription/overages`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  adjustBalance: (orgId: string, deltaCents: number) =>
    authedJson<{ org_id: string; balance_cents: number }>(`/v1/orgs/${orgId}/balance/adjust`, {
      method: "POST",
      body: JSON.stringify({ delta_cents: deltaCents }),
    }),

  getRecording: (sessionId: string) => authedJson<Recording>(`/v1/sessions/${sessionId}/recording`),
  listRecordings: (orgId: string, params?: ListParams) =>
    authedJson<Page<Recording>>(`/v1/orgs/${orgId}/recordings${qs(params)}`),
  getPlaybackUrl: (recordingId: string) =>
    authedJson<PlaybackUrl>(`/v1/recordings/${recordingId}/playback-url`),

  // Agents
  listAgents: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<Page<Agent>>(`/v1/orgs/${orgId}/projects/${projectId}/agents${qs(params)}`),
  getAgent: (agentId: string) => authedJson<Agent>(`/v1/agents/${agentId}`),
  getAgentDemoVariables: (agentId: string, overrides?: Record<string, string>) =>
    authedJson<{ values: Record<string, string> }>(`/v1/agents/${agentId}/demo-variables`, {
      method: "POST",
      body: JSON.stringify({ overrides: overrides || {} }),
    }),
  createAgent: (orgId: string, projectId: string, body: Partial<Agent>) =>
    authedJson<Agent>(`/v1/orgs/${orgId}/projects/${projectId}/agents`, { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (agentId: string, body: Partial<Agent>) =>
    authedJson<Agent>(`/v1/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveAgent: (agentId: string) => authedJson<Agent>(`/v1/agents/${agentId}/archive`, { method: "POST" }),
  listAgentVersions: (agentId: string, params?: ListParams) =>
    authedJson<Page<AgentVersion>>(`/v1/agents/${agentId}/versions${qs(params)}`),
  revertAgent: (agentId: string, version: number) =>
    authedJson<Agent>(`/v1/agents/${agentId}/revert/${version}`, { method: "POST" }),
  commitAgent: (agentId: string, message?: string) =>
    authedJson<Agent>(`/v1/agents/${agentId}/commit`, {
      method: "POST",
      body: JSON.stringify({ message: message || null }),
    }),

  // Agent tests (text-only LLM simulation) + background test runs
  listAgentTests: (agentId: string, params?: ListParams) =>
    authedJson<Page<AgentTest>>(`/v1/agents/${agentId}/tests${qs(params)}`),
  createAgentTest: (
    agentId: string,
    body: { name: string; scenario?: string; behaviors?: string[]; expected_tool_calls?: AgentTest["expected_tool_calls"] },
  ) => authedJson<AgentTest>(`/v1/agents/${agentId}/tests`, { method: "POST", body: JSON.stringify(body) }),
  updateAgentTest: (
    agentId: string,
    testId: string,
    body: Partial<{ name: string; scenario: string; behaviors: string[]; expected_tool_calls: AgentTest["expected_tool_calls"] }>,
  ) =>
    authedJson<AgentTest>(`/v1/agents/${agentId}/tests/${testId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAgentTest: (agentId: string, testId: string) =>
    authedJson<void>(`/v1/agents/${agentId}/tests/${testId}`, { method: "DELETE" }),
  startAgentTestRun: (agentId: string, body: { test_id?: string | null; multiplier?: number; run_name?: string | null }) =>
    authedJson<AgentTestRun>(`/v1/agents/${agentId}/test-runs`, { method: "POST", body: JSON.stringify(body) }),
  listAgentTestRuns: (agentId: string, params?: ListParams) =>
    authedJson<Page<AgentTestRun>>(`/v1/agents/${agentId}/test-runs${qs(params)}`),
  getAgentTestRun: (agentId: string, runId: string) =>
    authedJson<AgentTestRun>(`/v1/agents/${agentId}/test-runs/${runId}`),
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

  listToolCallEvents: (orgId: string, params?: ListParams & { agent_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.offset != null) sp.set("offset", String(params.offset));
    if (params?.agent_id) sp.set("agent_id", params.agent_id);
    const s = sp.toString();
    return authedJson<Page<ToolCallEvent>>(`/v1/orgs/${orgId}/tool-call-events${s ? `?${s}` : ""}`);
  },
  getToolCallStats: (orgId: string, agentId: string) =>
    authedJson<ToolCallStatsRow[]>(`/v1/orgs/${orgId}/agents/${agentId}/tool-call-stats`),

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
  patchTelephonyAccount: (accountId: string, body: TelephonyAccountPatchBody) =>
    authedJson<TelephonyAccount>(`/v1/telephony-accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTelephonyAccount: (accountId: string) =>
    authedJson<void>(`/v1/telephony-accounts/${accountId}`, { method: "DELETE" }),

  // Plivo-managed telephony (number search/purchase + India KYC)
  searchPlivoNumbers: (orgId: string, countryIso: string, pattern?: string) =>
    authedJson<PlivoNumberSearchOut>(
      `/v1/orgs/${orgId}/plivo/numbers/search?country_iso=${countryIso}${pattern ? `&pattern=${encodeURIComponent(pattern)}` : ""}`,
    ),
  purchasePlivoNumber: (orgId: string, body: PlivoPurchaseBody) =>
    authedJson<TelephonyAccount>(`/v1/orgs/${orgId}/plivo/numbers/purchase`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPlivoComplianceRequirements: (orgId: string) =>
    authedJson<PlivoComplianceRequirementsOut>(`/v1/orgs/${orgId}/plivo/compliance/requirements`),
  getPlivoComplianceStatus: (orgId: string) =>
    authedJson<PlivoComplianceApplication | null>(`/v1/orgs/${orgId}/plivo/compliance`),
  submitPlivoCompliance: (orgId: string, body: PlivoComplianceSubmitBody) =>
    authedJson<PlivoComplianceApplication>(`/v1/orgs/${orgId}/plivo/compliance`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  refreshPlivoCompliance: (orgId: string) =>
    authedJson<PlivoComplianceApplication | null>(`/v1/orgs/${orgId}/plivo/compliance/refresh`, { method: "POST" }),

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
  getBatchCallAnalytics: (batchId: string) =>
    authedJson<CampaignCallAnalytics>(`/v1/batches/${batchId}/call-analytics`),
  getCampaignAnalytics: (
    orgId: string,
    projectId: string,
    params?: { batch_id?: string | null; search?: string | null },
  ) => {
    const sp = new URLSearchParams();
    if (params?.batch_id) sp.set("batch_id", params.batch_id);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return authedJson<CampaignOutcomeRow[]>(
      `/v1/orgs/${orgId}/projects/${projectId}/batches/analytics${q ? `?${q}` : ""}`,
    );
  },
  listBatchContacts: (batchId: string, params?: ListParams) =>
    authedJson<Page<BatchContact>>(`/v1/batches/${batchId}/contacts${qs(params)}`),
  listBatchContactsCursor: (
    batchId: string,
    params?: { limit?: number; cursor?: string | null; status?: string | null; search?: string | null },
  ) => {
    const sp = new URLSearchParams();
    sp.set("limit", String(params?.limit ?? 50));
    sp.set("cursor", params?.cursor ?? "");
    if (params?.status) sp.set("status", params.status);
    if (params?.search) sp.set("search", params.search);
    return authedJson<CursorContactsPage>(`/v1/batches/${batchId}/contacts?${sp}`);
  },
  addBatchContactsBulk: (batchId: string, contacts: { phone_number: string; variables?: Record<string, unknown> }[]) =>
    authedJson<BatchContact[]>(`/v1/batches/${batchId}/contacts:bulk`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    }),
  deleteBatchContactsBulk: (batchId: string, contactIds: string[]) =>
    authedJson<{ deleted: number }>(`/v1/batches/${batchId}/contacts:bulk`, {
      method: "DELETE",
      body: JSON.stringify({ contact_ids: contactIds }),
    }),
  attachRecipientListToBatch: (batchId: string, recipientListId: string) =>
    authedJson<AttachListResult>(`/v1/batches/${batchId}/contacts:from-list`, {
      method: "POST",
      body: JSON.stringify({ recipient_list_id: recipientListId }),
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
  // Recipient lists (named reusable people batches)
  listRecipientLists: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<Page<RecipientList>>(`/v1/orgs/${orgId}/projects/${projectId}/recipient-lists${qs(params)}`),
  createRecipientList: (body: { org_id: string; project_id: string; name: string; description?: string }) =>
    authedJson<RecipientList>("/v1/recipient-lists", { method: "POST", body: JSON.stringify(body) }),
  getRecipientList: (listId: string) => authedJson<RecipientList>(`/v1/recipient-lists/${listId}`),
  patchRecipientList: (listId: string, body: { name?: string; description?: string }) =>
    authedJson<RecipientList>(`/v1/recipient-lists/${listId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRecipientList: (listId: string) =>
    authedJson<void>(`/v1/recipient-lists/${listId}`, { method: "DELETE" }),
  addRecipientListMembersBulk: (
    listId: string,
    members: { phone?: string; phone_number?: string; variables?: Record<string, unknown> }[],
  ) =>
    authedJson<MemberInsertResult>(`/v1/recipient-lists/${listId}/members:bulk`, {
      method: "POST",
      body: JSON.stringify({ members }),
    }),
  uploadRecipientListCsv: async (listId: string, file: File) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const form = new FormData();
    form.append("file", file);
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${BACKEND_URL}/v1/recipient-lists/${listId}/members`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed (${res.status})`);
    }
    return (await res.json()) as MemberInsertResult;
  },
  listRecipientListMembers: (listId: string, params?: { limit?: number; cursor?: string | null }) => {
    const sp = new URLSearchParams();
    sp.set("limit", String(params?.limit ?? 50));
    if (params?.cursor) sp.set("cursor", params.cursor);
    return authedJson<RecipientMembersPage>(`/v1/recipient-lists/${listId}/members?${sp}`);
  },
  patchRecipientListMember: (
    listId: string,
    memberId: string,
    body: { phone?: string; phone_number?: string; variables?: Record<string, unknown> },
  ) =>
    authedJson<RecipientListMember>(`/v1/recipient-lists/${listId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteRecipientListMember: (listId: string, memberId: string) =>
    authedJson<void>(`/v1/recipient-lists/${listId}/members/${memberId}`, { method: "DELETE" }),
  startBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/start`, { method: "POST" }),
  pauseBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/pause`, { method: "POST" }),
  resumeBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/resume`, { method: "POST" }),
  cancelBatch: (batchId: string) => authedJson<Batch>(`/v1/batches/${batchId}/cancel`, { method: "POST" }),
  hideBatch: (batchId: string) => authedJson<void>(`/v1/batches/${batchId}/hide`, { method: "POST" }),
  unhideBatches: (orgId: string, projectId: string) =>
    authedJson<{ unhidden: number }>(`/v1/orgs/${orgId}/projects/${projectId}/batches:unhide`, { method: "POST" }),
  deleteBatch: (batchId: string) => authedJson<void>(`/v1/batches/${batchId}`, { method: "DELETE" }),
  updateBatchSchedule: (batchId: string, schedule: BatchSchedule) =>
    authedJson<Batch>(`/v1/batches/${batchId}/schedule`, { method: "PATCH", body: JSON.stringify(schedule) }),

  listInbound: (orgId: string, projectId: string, params?: ListParams) =>
    authedJson<Page<InboundDeployment>>(`/v1/orgs/${orgId}/projects/${projectId}/inbound${qs(params)}`),
  createInbound: (body: InboundCreateBody) =>
    authedJson<InboundDeployment>("/v1/inbound", { method: "POST", body: JSON.stringify(body) }),
  getInbound: (deploymentId: string) => authedJson<InboundDeployment>(`/v1/inbound/${deploymentId}`),
  patchInbound: (deploymentId: string, body: InboundPatchBody) =>
    authedJson<InboundDeployment>(`/v1/inbound/${deploymentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteInbound: (deploymentId: string) => authedJson<void>(`/v1/inbound/${deploymentId}`, { method: "DELETE" }),

  listComposioToolkits: (orgId: string, params?: { category?: string; cursor?: string }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.cursor) sp.set("cursor", params.cursor);
    const q = sp.toString();
    return authedJson<ComposioToolkitsPage>(`/v1/orgs/${orgId}/composio/toolkits${q ? `?${q}` : ""}`);
  },
  listComposioToolkitTools: (orgId: string, toolkitSlug: string, cursor?: string) => {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return authedJson<ComposioToolsPage>(`/v1/orgs/${orgId}/composio/toolkits/${toolkitSlug}/tools${q}`);
  },
  listComposioConnections: (orgId: string) =>
    authedJson<ComposioConnection[]>(`/v1/orgs/${orgId}/composio/connections`),
  connectComposioToolkit: (orgId: string, toolkitSlug: string, callbackUrl: string) =>
    authedJson<ComposioConnectOut>(`/v1/orgs/${orgId}/composio/connections`, {
      method: "POST",
      body: JSON.stringify({ toolkit_slug: toolkitSlug, callback_url: callbackUrl }),
    }),
  refreshComposioConnection: (connectionId: string) =>
    authedJson<ComposioConnection>(`/v1/composio/connections/${connectionId}/refresh`, { method: "POST" }),
  disconnectComposio: (connectionId: string) =>
    authedJson<void>(`/v1/composio/connections/${connectionId}`, { method: "DELETE" }),
  attachComposioTool: (
    orgId: string,
    body: {
      toolkit_slug: string;
      tool_slug: string;
      connection_id: string;
      name?: string;
      label?: string;
    },
  ) => authedJson<CatalogTool>(`/v1/orgs/${orgId}/composio/tools`, { method: "POST", body: JSON.stringify(body) }),

  listKnowledgeBases: (orgId: string, projectId: string, params?: ListParams & { search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.offset != null) sp.set("offset", String(params.offset));
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString();
    return authedJson<Page<KnowledgeBase>>(
      `/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases${q ? `?${q}` : ""}`,
    );
  },
  createKnowledgeBase: (orgId: string, projectId: string, body: { name: string; description?: string }) =>
    authedJson<KnowledgeBase>(`/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getKnowledgeBase: (orgId: string, projectId: string, kbId: string) =>
    authedJson<KnowledgeBase>(`/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}`),
  patchKnowledgeBase: (
    orgId: string,
    projectId: string,
    kbId: string,
    body: { name?: string; description?: string },
  ) =>
    authedJson<KnowledgeBase>(`/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteKnowledgeBase: (orgId: string, projectId: string, kbId: string) =>
    authedJson<{ success: boolean }>(`/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}`, {
      method: "DELETE",
    }),
  listKnowledgeFiles: (orgId: string, projectId: string, kbId: string, params?: ListParams) =>
    authedJson<Page<KnowledgeFile>>(
      `/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}/files${qs(params)}`,
    ),
  uploadKnowledgeFile: async (orgId: string, projectId: string, kbId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return authedJson<KnowledgeFile>(
      `/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}/files`,
      { method: "POST", body: form },
    );
  },
  deleteKnowledgeFile: (orgId: string, projectId: string, kbId: string, fileId: string) =>
    authedJson<{ success: boolean }>(
      `/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}/files/${fileId}`,
      { method: "DELETE" },
    ),
  searchKnowledgeBase: (orgId: string, projectId: string, kbId: string, query: string, topK = 5) =>
    authedJson<{
      chunks: Array<{
        id: string;
        file_id: string;
        content: string;
        similarity: number;
        filename?: string;
        chunk_index?: number;
      }>;
      latency_ms: Record<string, number>;
    }>(`/v1/orgs/${orgId}/projects/${projectId}/knowledge-bases/${kbId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, top_k: topK }),
    }),
};
