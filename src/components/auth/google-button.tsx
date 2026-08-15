import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * "Continue with Google" — used for both sign in and sign up (OAuth doesn't
 * distinguish). New users land in onboarding; existing users go to `next`.
 */
export function GoogleButton({
  next = "/",
  label = "Continue with Google",
  disabled = false,
  onBusyChange,
  className,
}: {
  next?: string;
  label?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    onBusyChange?.(true);
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback },
    });
    if (error) {
      setLoading(false);
      onBusyChange?.(false);
      toast.error(error.message || "Could not continue with Google.");
    }
    // On success the browser navigates to Google, so nothing more to do here.
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("pressable h-11 w-full rounded-xl border-border/80 text-[14px] font-medium shadow-none", className)}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}

/** Shared "or" divider used between the primary action and the Google button. */
export function OrDivider({ className }: { className?: string }) {
  return (
    <div className={cn("relative py-1", className)}>
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-card px-2 text-muted-foreground uppercase tracking-wide">or</span>
      </div>
    </div>
  );
}
