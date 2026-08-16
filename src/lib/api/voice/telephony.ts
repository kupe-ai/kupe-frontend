import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";

// Real number search/purchase/KYC lives in
// @/components/voice-agents/add-number-dialog.tsx + api.searchPlivoNumbers /
// api.submitPlivoCompliance etc (app/routers/plivo.py on the backend) --
// this file now only wraps the plain telephony_accounts CRUD used by the
// phone-numbers table plus the inbound-calls / outbound-campaigns pages'
// active-number pickers.

export interface VoicePhoneNumber {
  id: string;
  e164_number: string;
  provider: "twilio" | "plivo" | "exotel";
  sip_trunk_id: string | null;
  status: "active";
  assigned_agent_id: string | null;
}

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
