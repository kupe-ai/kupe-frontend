import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/useAuth";
import { LoginLanding } from "@/components/auth/login-landing";
import { LoginForm } from "@/pages/login/login-form";
import { safeNextPath } from "@/lib/safe-next";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-caption">Loading…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to={next} replace />;
  }

  return (
    <LoginLanding>
      <LoginForm />
    </LoginLanding>
  );
}
