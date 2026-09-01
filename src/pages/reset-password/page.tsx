import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LoginLanding } from "@/components/auth/login-landing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const SESSION_WAIT_MS = 8_000;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setReady(true);
      setHasSession(false);
    }, SESSION_WAIT_MS);

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        window.clearTimeout(timeout);
        setHasSession(true);
        setReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        window.clearTimeout(timeout);
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You’re signed in.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground">Verifying reset link…</div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <LoginLanding
        title={
          <>
            Link expired
            <br />
            or invalid.
          </>
        }
        description="Request a new password reset email and try again."
      >
        <div className="flex flex-col gap-3.5">
          <Button asChild className="login-email-cta h-11 w-full rounded-xl text-[14px] font-medium">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
          <Link
            to="/login"
            className="text-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Link>
        </div>
      </LoginLanding>
    );
  }

  return (
    <LoginLanding
      title={
        <>
          Choose a new
          <br />
          password.
        </>
      }
      description="Enter a new password for your Kupe account."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password" className="text-[13px]">
            New password
          </Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="h-11 rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password" className="text-[13px]">
            Confirm password
          </Label>
          <Input
            id="confirm-password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
            className="h-11 rounded-xl"
          />
        </div>

        <Button
          type="submit"
          className="login-email-cta h-11 w-full rounded-xl text-[14px] font-medium"
          disabled={loading}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </LoginLanding>
  );
}
