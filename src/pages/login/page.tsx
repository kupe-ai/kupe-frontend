import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/useAuth";
import { LoginLanding } from "@/components/auth/login-landing";
import { LoginForm } from "@/pages/login/login-form";

export default function LoginPage() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-caption">Loading…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/voice-agents" replace />;
  }

  return (
    <LoginLanding>
      <LoginForm />
    </LoginLanding>
  );
}
