import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/useAuth";
import { useWorkspace } from "@/context/workspace-context";
import { useFeatureFlags } from "@/context/feature-flags-context";
import { withNextParam } from "@/lib/safe-next";

export default function ProtectedLayout() {
  const { session, loading, signOut } = useAuth();
  const workspace = useWorkspace();
  const flags = useFeatureFlags();
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;

  if (loading || workspace.loading || flags.loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={withNextParam("/login", here)} replace />;
  }

  if (!flags.isEnabled("account_access")) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm font-medium">This account is restricted</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Access to Kupe is turned off for your user. Ask a workspace owner to restore it in Settings → Access.
        </p>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  if (!workspace.org && workspace.orgs.length === 0) {
    return <Navigate to={withNextParam("/onboarding", here)} replace />;
  }

  return (
    <AppShell>
      {workspace.error && (
        <div className="border-b border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          {workspace.error}
        </div>
      )}
      <Outlet />
    </AppShell>
  );
}
