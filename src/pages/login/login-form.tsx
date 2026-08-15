import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);

  useEffect(() => {
    const error = params.get("error");
    if (error) toast.error(error);
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Check your email to confirm your account, then sign in.");
        setMode("sign-in");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || googleBusy;

  return (
    <div className="flex flex-col gap-4">
      <GoogleButton
        next={next}
        disabled={loading}
        onBusyChange={setGoogleBusy}
        className="login-google-btn h-11 rounded-xl border-border/80 bg-background text-[14px] font-medium shadow-none"
      />

      <OrDivider className="login-or" />

      {!emailMode ? (
        <Button
          type="button"
          className="login-email-cta h-11 w-full rounded-xl text-[14px] font-medium"
          onClick={() => setEmailMode(true)}
          disabled={busy}
        >
          Continue with email
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-[13px]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-[13px]">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
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

          <Button
            type="submit"
            className="login-email-cta h-11 w-full rounded-xl text-[14px] font-medium"
            disabled={busy}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>

          <button
            type="button"
            className="text-center text-[13px] text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            disabled={busy}
          >
            {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      )}

      <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        By continuing, you agree to Kupe&apos;s{" "}
        <span className="underline underline-offset-2">Terms</span> and{" "}
        <span className="underline underline-offset-2">Privacy Policy</span>.
      </p>
    </div>
  );
}
