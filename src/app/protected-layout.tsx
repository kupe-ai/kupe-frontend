import { Navigate, Outlet } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/useAuth";
import { useWorkspace } from "@/context/workspace-context";

export default function ProtectedLayout() {
  const { session, loading } = useAuth();
  const workspace = useWorkspace();

  if (loading || workspace.loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
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
