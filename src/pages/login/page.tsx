import { Navigate } from "react-router-dom";
import AuthPanel from "@/AuthPanel";
import { useAuth } from "@/lib/useAuth";
import { BrandLockup } from "@/components/brand/wordmark";

export default function LoginPage() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/voice-agents" replace />;
  }

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-8 overflow-y-auto bg-background p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup />
        <p className="text-sm text-muted-foreground">Sign in to your voice agent console.</p>
      </div>
      <AuthPanel />
    </div>
  );
}
