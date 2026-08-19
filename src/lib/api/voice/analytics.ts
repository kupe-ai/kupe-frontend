import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";

export async function getAnalyticsOverview(_params: { agent_id?: string; campaign_id?: string } = {}) {
  const { orgId } = requireScope();
  const sessions = await api.listSessions(orgId, { limit: 100 });
  const items = sessions.items;
  const connected = items.filter((s) => s.status === "ended" || s.status === "active").length;
  const volume_by_hour: Record<string, number> = {};
  for (const s of items) {
    const hour = new Date(s.created_at).getHours();
    const key = String(hour);
    volume_by_hour[key] = (volume_by_hour[key] ?? 0) + 1;
  }
  return {
    total_calls: items.length,
    connected_calls: connected,
    connectivity_rate: items.length ? connected / items.length : 0,
    avg_duration_seconds: 0,
    volume_by_hour,
    failure_reasons: {} as Record<string, number>,
  };
}

export async function getAnalyticsConnectivity(_params: { agent_id?: string } = {}) {
  return { phone_number_health: {} as Record<string, Record<string, number>> };
}

export async function getAnalyticsEngagement(_params: { agent_id?: string } = {}) {
  const overview = await getAnalyticsOverview();
  return {
    funnel: {
      attempted: overview.total_calls,
      connected: overview.connected_calls,
      engaged: overview.connected_calls,
    },
    by_language: {} as Record<string, number>,
  };
}

export async function getAnalyticsGoals(_params: { agent_id?: string } = {}) {
  return { goal_status: {} as Record<string, number> };
}

export async function getAnalyticsGroupBy(
  _dimension: "campaign" | "agent" = "campaign",
  params: { batch_id?: string | null; search?: string | null } = {},
) {
  const { orgId, projectId } = requireScope();
  return api.getCampaignAnalytics(orgId, projectId, params);
}
