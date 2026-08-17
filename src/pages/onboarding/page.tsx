import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import { safeNextPath, withNextParam } from "@/lib/safe-next";
import { useWorkspace } from "@/context/workspace-context";
import { api } from "@/lib/api";
import { BrandLockup } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * First-run gate: a brand-new account has no organization yet. This page
 * creates one (plus a default project) and drops the user straight into
 * the console — no multi-step wizard, nothing to configure up front.
 */
export default function OnboardingPage() {
  const { session, loading: authLoading } = useAuth();
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (authLoading || workspace.loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-caption">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={withNextParam("/login", next)} replace />;
  }

  // Already has an org — nothing to onboard.
  if (workspace.orgs.length > 0) {
    return <Navigate to={next} replace />;
  }

  const suggestedName =
    (session.user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    session.user.email?.split("@")[0] ||
    "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim() || `${suggestedName}'s workspace`;
    setSubmitting(true);
    try {
      const org = await api.createOrg(trimmed);
      await api.createProject(org.id, "Default");
      localStorage.setItem("kupe.orgId", org.id);
      workspace.refresh();
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your workspace");
      setSubmitting(false);
    }
  }

  return (
    <div className="login-landing flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-[#f9f7f2] p-6 text-[#1d1d1c] dark:bg-[#0e0e0e] dark:text-[#f5f2eb]">
      <div className="animate-fade-in flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLockup />
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight">Welcome to Kupe</h1>
            <p className="mt-1 text-[13px] text-[#1d1d1c]/55 dark:text-white/55">Let&apos;s set up your workspace.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="w-full rounded-[1.35rem] border border-black/[0.06] bg-white p-6 shadow-[0_8px_30px_-18px_rgba(29,29,28,0.35)] dark:border-white/10 dark:bg-[#161616] dark:shadow-none">
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name" className="text-[13px]">
              Workspace name
            </Label>
            <Input
              id="workspace-name"
              autoFocus
              placeholder={suggestedName ? `${suggestedName}'s workspace` : "Acme Inc."}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="h-11 rounded-xl"
            />
          </div>

          <Button type="submit" className="login-email-cta mt-4 h-11 w-full rounded-xl text-[14px] font-medium" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {submitting ? "Creating…" : "Continue"}
          </Button>
        </form>

        <p className="max-w-xs text-center text-[13px] text-[#1d1d1c]/45 dark:text-white/45">
          You can invite teammates and create more projects later from Settings.
        </p>
      </div>
    </div>
  );
}
