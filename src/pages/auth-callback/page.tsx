import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * Google OAuth lands here (redirectTo set in components/auth/google-button.tsx).
 * @supabase/supabase-js's browser client has `detectSessionInUrl: true` by
 * default, so it exchanges the auth code for a session automatically on
 * load — this page just waits for that to resolve, then routes onward.
 * There is no server-side callback route in a static SPA.
 */
export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setOk(!!data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        setOk(true);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground">Signing you in…</div>
      </div>
    );
  }

  return <Navigate to={ok ? next : "/login"} replace />;
}
