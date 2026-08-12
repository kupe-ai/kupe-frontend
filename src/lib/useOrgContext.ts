import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Membership, Organization, Project } from "../types";

const ORG_KEY = "kupe.orgId";
const PROJECT_KEY = "kupe.projectId";

export function useOrgContext(enabled: boolean) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (preferredOrgId?: string | null, preferredProjectId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const orgsPage = await api.listOrgs({ limit: 100 });
      const nextOrgs = orgsPage.items;
      setOrgs(nextOrgs);
      if (!nextOrgs.length) {
        setOrg(null);
        setProjects([]);
        setProject(null);
        setMembership(null);
        setError("No organization yet — create one in Settings, or sign out and create a new account.");
        return;
      }
      const storedOrg = preferredOrgId ?? localStorage.getItem(ORG_KEY);
      const nextOrg = nextOrgs.find((o) => o.id === storedOrg) ?? nextOrgs[0];
      setOrg(nextOrg);
      localStorage.setItem(ORG_KEY, nextOrg.id);

      const [projectsPage, me] = await Promise.all([
        api.listProjects(nextOrg.id, { limit: 100 }),
        api.getMembership(nextOrg.id),
      ]);
      const nextProjects = projectsPage.items.filter((p) => !p.archived_at);
      setProjects(nextProjects);
      setMembership(me);

      const storedProject = preferredProjectId ?? localStorage.getItem(PROJECT_KEY);
      const nextProject = nextProjects.find((p) => p.id === storedProject) ?? nextProjects[0] ?? null;
      setProject(nextProject);
      if (nextProject) localStorage.setItem(PROJECT_KEY, nextProject.id);
      else localStorage.removeItem(PROJECT_KEY);
      if (!nextProject) setError("Your organization has no projects you can access.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setOrg(null);
      setProject(null);
      setLoading(false);
      return;
    }
    void load();
  }, [enabled, load]);

  const selectOrg = useCallback(
    (orgId: string) => {
      localStorage.setItem(ORG_KEY, orgId);
      localStorage.removeItem(PROJECT_KEY);
      void load(orgId, null);
    },
    [load],
  );

  const selectProject = useCallback((next: Project) => {
    setProject(next);
    localStorage.setItem(PROJECT_KEY, next.id);
  }, []);

  return {
    orgs,
    org,
    projects,
    project,
    membership,
    loading,
    error,
    selectOrg,
    selectProject,
    refresh: () => load(org?.id, project?.id),
  };
}
