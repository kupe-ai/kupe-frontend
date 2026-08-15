import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { useOrgContext } from "@/lib/useOrgContext";
import { setWorkspaceScope } from "@/lib/api/workspace-scope";
import type { Membership, Organization, Project } from "@/types";

type WorkspaceValue = {
  orgs: Organization[];
  org: Organization | null;
  projects: Project[];
  project: Project | null;
  membership: Membership | null;
  loading: boolean;
  error: string | null;
  selectOrg: (orgId: string) => void;
  selectProject: (project: Project) => void;
  refresh: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const org = useOrgContext(Boolean(session));

  useEffect(() => {
    setWorkspaceScope(org.org, org.project);
  }, [org.org, org.project]);

  return <WorkspaceContext.Provider value={org}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}
