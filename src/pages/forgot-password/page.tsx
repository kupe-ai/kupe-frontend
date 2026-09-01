import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LoginLanding } from "@/components/auth/login-landing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (authLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-caption">Loading…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
      toast.success("Check your email for a password reset link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginLanding
      title={
        <>
          Reset your
          <br />
          password.
        </>
      }
      description="Enter the email on your account and we’ll send a link to choose a new password."
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            you’ll get a reset link shortly. Check spam if it doesn’t arrive.
          </p>
          <Button asChild className="login-email-cta h-11 w-full rounded-xl text-[14px] font-medium">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="forgot-email" className="text-[13px]">
              Email
            </Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "Sending…" : "Send reset link"}
          </Button>

          <Link
            to="/login"
            className="text-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </LoginLanding>
  );
}
