import { api } from "@/lib/api";
import { requireScope } from "@/lib/api/workspace-scope";
import { formatDateTimeValue } from "@/lib/format";
import type { InboundAvailability, InboundDeployment, InboundPatchBody } from "@/types";

export type VoiceInboundDeployment = InboundDeployment;
export type { InboundAvailability };

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function defaultInboundAvailability(): InboundAvailability {
  return {
    always: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    days_of_week: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "18:00",
    after_hours_message: "",
  };
}

export function availabilitySummary(a: InboundAvailability): string {
  if (a.always) return `Always available · ${a.timezone.replaceAll("_", " ")}`;
  const days =
    a.days_of_week.length === 7
      ? "Every day"
      : a.days_of_week.map((d) => DAY_LABELS[d]).join(", ");
  return `${days} · ${formatDateTimeValue(a.start)}–${formatDateTimeValue(a.end)} · ${a.timezone.replaceAll("_", " ")}`;
}

function weekdaySun0(at: Date, timeZone: string): number {
  const w = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(at);
  return DAY_LABELS.indexOf(w as (typeof DAY_LABELS)[number]);
}

function minutesInTz(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function parseMinutes(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

export function isWithinHours(a: InboundAvailability, at = new Date()): boolean {
  if (a.always) return true;
  const weekday = weekdaySun0(at, a.timezone);
  if (!a.days_of_week.includes(weekday)) return false;
  const now = minutesInTz(at, a.timezone);
  const start = parseMinutes(a.start);
  const end = parseMinutes(a.end);
  if (start === end) return true;
  if (start < end) return start <= now && now <= end;
  return now >= start || now <= end;
}

export async function listInboundDeployments() {
  const { orgId, projectId } = requireScope();
  const page = await api.listInbound(orgId, projectId, { limit: 100 });
  return page.items;
}

export async function createInboundDeployment(data: {
  name: string;
  agent_id: string;
  phone_number_id: string;
  availability?: InboundAvailability;
}) {
  const { orgId, projectId } = requireScope();
  return api.createInbound({
    org_id: orgId,
    project_id: projectId,
    name: data.name,
    agent_id: data.agent_id,
    telephony_account_id: data.phone_number_id,
    status: "active",
    availability: data.availability ?? defaultInboundAvailability(),
  });
}

export async function updateInboundDeployment(id: string, data: InboundPatchBody) {
  return api.patchInbound(id, data);
}

export async function deleteInboundDeployment(id: string) {
  await api.deleteInbound(id);
  return { success: true };
}
