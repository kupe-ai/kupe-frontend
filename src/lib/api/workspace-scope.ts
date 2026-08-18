import { KoriApiError } from "@/lib/api/kori-errors";
import type { Organization, Project } from "@/types";

let scope: { orgId: string; projectId: string } | null = null;

export function setWorkspaceScope(org: Organization | null, project: Project | null) {
  if (!org?.id || !project?.id) {
    scope = null;
    return;
  }
  scope = { orgId: org.id, projectId: project.id };
}

export function getWorkspaceScope() {
  return scope;
}

export function requireScope() {
  if (!scope?.orgId || !scope?.projectId) {
    throw new KoriApiError(400, "Select an organization and project first.");
  }
  return scope;
}
