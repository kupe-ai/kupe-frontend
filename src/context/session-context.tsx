import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { useWorkspaceOptional } from "@/context/workspace-context";

export interface SessionProfile {
  id: string;
  full_name: string;
  email: string;
  organization_id: string;
  [key: string]: unknown;
}

export interface SessionDepartment {
  id: string;
  name: string;
}

export interface SessionContextValue {
  userId: string;
  profile: SessionProfile;
  departments: SessionDepartment[];
  currentDepartmentId: string | null;
}

const SessionContext = createContext<{ session: SessionContextValue | null }>({ session: null });

export function SessionBridgeProvider({ children }: { children: ReactNode }) {
  const { session: auth } = useAuth();
  const workspace = useWorkspaceOptional();

  const value = useMemo(() => {
    if (!auth) return { session: null };
    const email = auth.user.email ?? "";
    const fullName =
      (auth.user.user_metadata?.full_name as string | undefined)?.trim() ||
      email.split("@")[0] ||
      "there";
    const session: SessionContextValue = {
      userId: auth.user.id,
      profile: {
        id: auth.user.id,
        full_name: fullName,
        email,
        organization_id: workspace?.org?.id ?? "",
      },
      departments: workspace?.org
        ? [{ id: workspace.project?.id ?? workspace.org.id, name: workspace.org.name }]
        : [],
      currentDepartmentId: workspace?.project?.id ?? null,
    };
    return { session };
  }, [auth, workspace?.org, workspace?.project]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export function useWorkspaceScopeKey() {
  const workspace = useWorkspaceOptional();
  return `${workspace?.org?.id ?? ""}:${workspace?.project?.id ?? ""}`;
}
