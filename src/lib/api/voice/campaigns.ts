import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import type { Batch } from "@/types";

export interface VoiceCampaign {
  id: string;
  name: string;
  agent_id: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  connection_config: Record<string, unknown>;
  schedule: Record<string, unknown>;
}

export interface VoiceDialJob {
  id: string;
  campaign_id: string;
  phone_e164: string;
  status: "queued" | "dialing" | "connected" | "failed" | "done";
}

function mapStatus(status: string): VoiceCampaign["status"] {
  if (status === "cancelled") return "completed";
  if (status === "draft" || status === "running" || status === "paused" || status === "completed") {
    return status;
  }
  return "draft";
}

function toCampaign(b: Batch): VoiceCampaign {
  return {
    id: b.id,
    name: b.name,
    agent_id: b.agent_id,
    status: mapStatus(b.status),
    connection_config: { telephony_account_id: b.telephony_account_id },
    schedule: {},
  };
}

export async function listCampaigns() {
  const { orgId, projectId } = requireScope();
  const page = await api.listBatches(orgId, projectId, { limit: 100 });
  return page.items.map(toCampaign);
}

export async function createCampaign(
  orgId: string,
  workspaceId: string,
  data: {
    name: string;
    agent_id: string;
    agent_version?: number;
    connection_config?: Record<string, unknown>;
    schedule?: Record<string, unknown>;
  },
) {
  const accounts = await api.listTelephonyAccounts(orgId);
  const wanted = data.connection_config?.phone_number_id as string | undefined;
  const account =
    accounts.find((a) => a.id === wanted || a.from_number === wanted) ??
    accounts.find((a) => a.is_default) ??
    accounts[0];
  if (!account) {
    throw new Error("Add a telephony account in Settings before launching campaigns.");
  }
  const batch = await api.createBatch({
    org_id: orgId,
    project_id: workspaceId,
    agent_id: data.agent_id,
    telephony_account_id: account.id,
    name: data.name,
  });
  return toCampaign(batch);
}

export async function uploadCampaignCohort(campaignId: string, file: File) {
  const rows = await api.uploadBatchContactsCsv(campaignId, file);
  return { row_count: rows.length };
}

export async function pauseCampaign(campaignId: string) {
  return toCampaign(await api.pauseBatch(campaignId));
}

export async function resumeCampaign(campaignId: string) {
  const batch = await api.getBatch(campaignId);
  if (batch.status === "draft") return toCampaign(await api.startBatch(campaignId));
  return toCampaign(await api.resumeBatch(campaignId));
}

export async function listDialJobs(campaignId: string): Promise<VoiceDialJob[]> {
  const page = await api.listBatchContacts(campaignId, { limit: 100 });
  return page.items.map((c) => ({
    id: c.id,
    campaign_id: campaignId,
    phone_e164: c.phone_number,
    status:
      c.status === "completed"
        ? "done"
        : c.status === "failed" || c.status === "exhausted"
          ? "failed"
          : c.status === "in_progress"
            ? "dialing"
            : "queued",
  }));
}
