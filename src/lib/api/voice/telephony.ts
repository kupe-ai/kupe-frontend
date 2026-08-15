import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import { readStore, scopedKey, writeStore } from "@/lib/api/local-store";

export interface VoicePhoneNumber {
  id: string;
  e164_number: string;
  provider: "twilio" | "plivo" | "exotel";
  sip_trunk_id: string | null;
  status: "pending_kyc" | "provisioning" | "active" | "suspended" | "released";
  assigned_agent_id: string | null;
}

export interface VoiceKycApplication {
  id: string;
  kind: "individual" | "company";
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
}

const KYC_KEY = () => scopedKey("kyc", requireScope().orgId);

export async function listSipTrunks() {
  const { orgId } = requireScope();
  const accounts = await api.listTelephonyAccounts(orgId);
  return accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    label: a.label || a.from_number,
    is_default: a.is_default,
  }));
}

export async function createSipTrunk(data: {
  provider: string;
  label: string;
  credentials: Record<string, string>;
}) {
  const { orgId } = requireScope();
  return api.createTelephonyAccount(orgId, {
    provider: data.provider as "twilio" | "plivo" | "exotel",
    label: data.label,
    account_sid: data.credentials.account_sid ?? data.credentials.sid ?? "",
    api_key: data.credentials.api_key ?? data.credentials.token ?? "",
    from_number: data.credentials.from_number ?? "",
  });
}

export async function submitKyc(data: {
  kind: "individual" | "company";
  pan_number?: string;
  aadhaar_last4?: string;
  company_pan?: string;
  gstin?: string;
  documents?: Array<{ kind: string; storage_path: string }>;
}): Promise<VoiceKycApplication> {
  const row: VoiceKycApplication = {
    id: crypto.randomUUID(),
    kind: data.kind,
    status: "submitted",
    rejection_reason: null,
    created_at: new Date().toISOString(),
  };
  const rows = readStore<VoiceKycApplication[]>(KYC_KEY(), []);
  writeStore(KYC_KEY(), [row, ...rows]);
  return row;
}

export async function listKycApplications() {
  try {
    return readStore<VoiceKycApplication[]>(KYC_KEY(), []);
  } catch {
    return [];
  }
}

export async function getKycApplication(id: string) {
  const row = (await listKycApplications()).find((k) => k.id === id);
  if (!row) throw new Error("KYC application not found");
  return row;
}

export async function listPhoneNumbers(): Promise<VoicePhoneNumber[]> {
  const { orgId } = requireScope();
  const accounts = await api.listTelephonyAccounts(orgId);
  return accounts.map((a) => ({
    id: a.id,
    e164_number: a.from_number,
    provider: a.provider,
    sip_trunk_id: a.id,
    status: "active",
    assigned_agent_id: null,
  }));
}

export async function requestPhoneNumber(_data: {
  kyc_application_id: string;
  sip_trunk_id: string;
  area_or_prefix?: string;
}): Promise<VoicePhoneNumber> {
  throw new Error("Number rental is not available yet — add a Twilio, Plivo, or Exotel account in Settings.");
}

export async function releasePhoneNumber(_id: string): Promise<VoicePhoneNumber> {
  throw new Error("Release is not available for connected telephony accounts.");
}

export async function assignPhoneNumber(id: string, agentId: string): Promise<VoicePhoneNumber> {
  const numbers = await listPhoneNumbers();
  const n = numbers.find((x) => x.id === id);
  if (!n) throw new Error("Number not found");
  return { ...n, assigned_agent_id: agentId };
}
