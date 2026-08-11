import { useEffect, useState } from "react";
import { api } from "./api";
import type { Organization, Project } from "../types";

/** Every signed-up user gets a personal default org + project auto-created
 * server-side (see kupe-backend's signup trigger), so v1 just picks the
 * first of each rather than showing a picker -- multi-org support in the UI
 * is a natural later addition, not required for the current backend
 * capability to be usable.
 */
export function useOrgContext(enabled: boolean) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setOrg(null);
      setProject(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const orgs = await api.listOrgs();
        if (cancelled) return;
        const firstOrg = orgs[0] ?? null;
        setOrg(firstOrg);
        if (!firstOrg) {
          setError("No organization yet — sign out and create a new account, or create an org via the API.");
          return;
        }
        const projects = await api.listProjects(firstOrg.id);
        if (cancelled) return;
        setProject(projects[0] ?? null);
        if (!projects[0]) {
          setError("Your organization has no projects yet.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load organization");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { org, project, loading, error };
}
