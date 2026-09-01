import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { safeNextPath } from "@/lib/safe-next";

const SESSION_WAIT_MS = 10_000;

function urlLooksLikePasswordRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const fromQuery = new URLSearchParams(window.location.search).get("type");
  if (fromQuery === "recovery") return true;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash).get("type") === "recovery";
}

/**
 * OAuth / email-confirm land here (redirectTo set in google-button / signUp).
 * @supabase/supabase-js's browser client has `detectSessionInUrl: true` by
 * default, so it exchanges the auth code for a session automatically on
 * load — this page waits for that to resolve, then routes onward.
 * PASSWORD_RECOVERY is sent to /reset-password instead of `next`.
 */
export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const recoveryRef = useRef(urlLooksLikePasswordRecovery());
  const notifiedLoginRef = useRef(false);

  useEffect(() => {
    if (!ready || !ok || recovery || notifiedLoginRef.current) return;
    notifiedLoginRef.current = true;
    void api.notifyLoginActivity().catch(() => undefined);
  }, [ready, ok, recovery]);

  useEffect(() => {
    let cancelled = false;

    const oauthError =
      searchParams.get("error_description") ||
      searchParams.get("error") ||
      searchParams.get("error_code");
    if (oauthError) {
      const message = decodeURIComponent(oauthError.replace(/\+/g, " "));
      toast.error(message);
      setFailMessage(message);
      setReady(true);
      setOk(false);
      return;
    }

    const markReady = (sessionOk: boolean, isRecovery: boolean) => {
      if (cancelled) return;
      if (isRecovery) recoveryRef.current = true;
      setOk(sessionOk);
      setRecovery(recoveryRef.current);
      setReady(true);
    };

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      const message =
        "Sign-in didn’t complete. The link may be expired, or this redirect URL isn’t allowlisted.";
      toast.error(message);
      setFailMessage(message);
      setReady(true);
      setOk(false);
    }, SESSION_WAIT_MS);

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      window.clearTimeout(timeout);
      markReady(true, recoveryRef.current || urlLooksLikePasswordRecovery());
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        window.clearTimeout(timeout);
        markReady(true, true);
        return;
      }
      if (session) {
        window.clearTimeout(timeout);
        markReady(true, recoveryRef.current || urlLooksLikePasswordRecovery());
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [searchParams]);

  if (!ready) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground">Signing you in…</div>
      </div>
    );
  }

  if (recovery) {
    return <Navigate to="/reset-password" replace />;
  }

  if (ok) {
    return <Navigate to={next} replace />;
  }

  const loginError = failMessage || "Could not complete sign-in. Please try again.";
  return <Navigate to={`/login?error=${encodeURIComponent(loginError)}`} replace />;
}
