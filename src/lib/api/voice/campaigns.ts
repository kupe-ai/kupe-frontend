import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import { EMPTY_BATCH_SCHEDULE, type Batch, type BatchSchedule, type RecipientList } from "@/types";
import {
  analyzeRecipients,
  PHONE_COLUMN,
  recipientsToCsvFile,
  type RecipientRow,
} from "@/lib/parse-recipients-csv";

export type { BatchSchedule, RecipientList };
export { EMPTY_BATCH_SCHEDULE };

export interface VoiceCampaign {
  id: string;
  name: string;
  agent_id: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  connection_config: Record<string, unknown>;
  schedule: BatchSchedule;
  recipient_list_id?: string | null;
  started_at?: string | null;
}

export interface VoiceDialJob {
  id: string;
  campaign_id: string;
  phone_e164: string;
  status: "queued" | "dialing" | "connected" | "failed" | "done";
  variables?: Record<string, unknown>;
  attempt_count?: number;
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
    schedule: b.schedule ?? EMPTY_BATCH_SCHEDULE,
    recipient_list_id: b.recipient_list_id ?? null,
    started_at: b.started_at ?? null,
  };
}

export async function listCampaigns() {
  const { orgId, projectId } = requireScope();
  const page = await api.listBatches(orgId, projectId, { limit: 100 });
  return page.items.map(toCampaign);
}

export async function getCampaign(campaignId: string) {
  return toCampaign(await api.getBatch(campaignId));
}

export async function getCampaignStats(campaignId: string) {
  return api.getBatchStats(campaignId);
}

export async function getCampaignCallAnalytics(campaignId: string) {
  return api.getBatchCallAnalytics(campaignId);
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

export async function updateCampaignSchedule(campaignId: string, schedule: BatchSchedule) {
  return toCampaign(await api.updateBatchSchedule(campaignId, schedule));
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

export function canDeleteCampaign(campaign: Pick<VoiceCampaign, "status" | "started_at">) {
  return campaign.status === "draft" && !campaign.started_at;
}

export async function hideCampaign(campaignId: string) {
  await api.hideBatch(campaignId);
}

export async function unhideAllCampaigns() {
  const { orgId, projectId } = requireScope();
  return api.unhideBatches(orgId, projectId);
}

export async function deleteCampaign(campaignId: string) {
  await api.deleteBatch(campaignId);
}

export async function cloneCampaign(sourceId: string): Promise<VoiceCampaign> {
  const source = await api.getBatch(sourceId);
  const created = await api.createBatch({
    org_id: source.org_id,
    project_id: source.project_id,
    agent_id: source.agent_id,
    telephony_account_id: source.telephony_account_id,
    name: source.name,
    max_concurrent_calls: source.max_concurrent_calls,
    retry_policy: source.retry_policy,
    schedule: source.schedule,
  });
  if (source.recipient_list_id) {
    await api.attachRecipientListToBatch(created.id, source.recipient_list_id);
  } else {
    let cursor: string | null = "";
    for (;;) {
      const page = await api.listBatchContactsCursor(sourceId, {
        limit: 200,
        cursor: cursor || "",
      });
      if (page.items.length > 0) {
        await api.addBatchContactsBulk(
          created.id,
          page.items.map((c) => ({
            phone_number: c.phone_number,
            variables: c.variables ?? {},
          })),
        );
      }
      if (!page.next_cursor || page.items.length === 0) break;
      cursor = page.next_cursor;
    }
  }
  return toCampaign(await api.getBatch(created.id));
}

export async function listRecipientLists(params?: { limit?: number; offset?: number; name?: string }) {
  const { orgId, projectId } = requireScope();
  return api.listRecipientLists(orgId, projectId, params);
}

export async function createNamedRecipientList(name: string, description = "") {
  const { orgId, projectId } = requireScope();
  return api.createRecipientList({ org_id: orgId, project_id: projectId, name, description });
}

export async function findRecipientListByName(name: string): Promise<RecipientList | null> {
  const page = await listRecipientLists({ limit: 1, name: name.trim() });
  return page.items[0] ?? null;
}

export async function saveRecipientsToList(
  listId: string,
  columns: string[],
  rows: RecipientRow[],
): Promise<{ inserted: number; member_count: number }> {
  const people = rows.filter((row) => row.values[PHONE_COLUMN]?.trim());
  if (people.length === 0) return { inserted: 0, member_count: 0 };
  // Prefer CSV multipart for larger sets (chunked server-side).
  if (people.length > 200) {
    return api.uploadRecipientListCsv(listId, recipientsToCsvFile(columns, people));
  }
  const members = people.map((row) => ({
    phone: row.values[PHONE_COLUMN]?.trim() ?? "",
    variables: Object.fromEntries(
      columns.filter((c) => c !== PHONE_COLUMN).map((c) => [c, row.values[c] ?? ""]),
    ),
  }));
  return api.addRecipientListMembersBulk(listId, members);
}

export async function attachListToCampaign(campaignId: string, listId: string) {
  return api.attachRecipientListToBatch(campaignId, listId);
}

export async function ensureCampaignRecipients(opts: {
  campaignId: string;
  mode: "new" | "saved";
  listName: string;
  selectedListId: string | null;
  boundListId?: string | null;
  alreadyAttached?: boolean;
  columns: string[];
  rows: RecipientRow[];
}): Promise<{ listId: string; people: number; copied: number }> {
  const people = analyzeRecipients(opts.columns, opts.rows).people;

  if (opts.mode === "saved") {
    if (!opts.selectedListId) throw new Error("Pick a saved recipient list");
    if (opts.alreadyAttached && opts.boundListId === opts.selectedListId) {
      return { listId: opts.selectedListId, people: 0, copied: 0 };
    }
    const attached = await api.attachRecipientListToBatch(opts.campaignId, opts.selectedListId);
    return { listId: opts.selectedListId, people: attached.copied, copied: attached.copied };
  }

  if (people === 0) throw new Error("Add at least one recipient with a phone number");
  const name = opts.listName.trim() || `Recipients ${new Date().toLocaleString()}`;

  let listId = opts.boundListId ?? null;
  if (!listId) {
    const existing = await findRecipientListByName(name);
    if (existing) {
      listId = existing.id;
    } else {
      const list = await createNamedRecipientList(name);
      listId = list.id;
    }
  }

  const saved = await saveRecipientsToList(listId, opts.columns, opts.rows);
  if (saved.inserted === 0 && !opts.alreadyAttached) {
    throw new Error("No recipients with a phone number to save");
  }

  if (opts.alreadyAttached) {
    return { listId, people: saved.inserted, copied: 0 };
  }

  const attached = await api.attachRecipientListToBatch(opts.campaignId, listId);
  return { listId, people: saved.inserted, copied: attached.copied };
}

export async function removeCampaignRecipients(campaignId: string, contactIds: string[]) {
  return api.deleteBatchContactsBulk(campaignId, contactIds);
}

export async function listDialJobsPage(
  campaignId: string,
  params?: { limit?: number; cursor?: string | null; status?: string | null; search?: string | null },
) {
  const page = await api.listBatchContactsCursor(campaignId, params);
  return {
    ...page,
    items: page.items.map((c) => ({
      id: c.id,
      campaign_id: campaignId,
      phone_e164: c.phone_number,
      variables: c.variables,
      attempt_count: c.attempt_count,
      status:
        c.live_status === "talking" || c.attempt_status === "in_progress"
          ? ("connected" as const)
          : c.status === "completed"
            ? ("done" as const)
            : c.status === "failed" || c.status === "exhausted"
              ? ("failed" as const)
              : c.status === "in_progress"
                ? ("dialing" as const)
                : ("queued" as const),
      raw_status: c.status,
      attempt_status: c.attempt_status ?? null,
      live_status: c.live_status ?? null,
    })),
  };
}

export async function listDialJobs(campaignId: string): Promise<VoiceDialJob[]> {
  const page = await listDialJobsPage(campaignId, { limit: 100, cursor: "" });
  return page.items;
}

export type CampaignLiveEvent = {
  batch_id?: string;
  campaign_status?: VoiceCampaign["status"] | "cancelled";
  contact_id?: string | null;
  live_status?: string | null;
  attempt_status?: string | null;
  contact_status?: string | null;
  talking?: number;
  left?: number;
  done?: number;
  contacts_by_status?: Record<string, number>;
  attempts_by_status?: Record<string, number>;
};

function parseSseDataFrames(buffer: string): { events: CampaignLiveEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: CampaignLiveEvent[] = [];
  for (const frame of parts) {
    const line = frame.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as CampaignLiveEvent);
    } catch {
      /* ping / malformed */
    }
  }
  return { events, rest };
}

export async function subscribeCampaignLive(
  campaignId: string,
  onEvent: (event: CampaignLiveEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await api.streamBatchEvents(campaignId, signal);
  if (!res.ok || !res.body) {
    throw new Error(`Live status stream failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseDataFrames(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) onEvent(event);
  }
}
