import { BACKEND_URL } from "../config";
import { supabase } from "./supabase";
import type {
  CreateSessionBody,
  Organization,
  Project,
  Recording,
  SessionInfo,
  UsageSummaryRow,
} from "../types";

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
  listOrgs: () => authedJson<Organization[]>("/v1/orgs"),
  listProjects: (orgId: string) => authedJson<Project[]>(`/v1/orgs/${orgId}/projects`),
  createSession: (body: CreateSessionBody) =>
    authedJson<SessionInfo>("/v1/sessions", { method: "POST", body: JSON.stringify(body) }),
  endSession: (sessionId: string) => authedJson<SessionInfo>(`/v1/sessions/${sessionId}/end`, { method: "POST" }),
  usageSummary: (orgId: string) => authedJson<UsageSummaryRow[]>(`/v1/orgs/${orgId}/usage`),
  getRecording: (sessionId: string) => authedJson<Recording>(`/v1/sessions/${sessionId}/recording`),
};
