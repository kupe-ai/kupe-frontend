import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { BrandLockup } from "@/components/brand/wordmark";
import { LoginShowcase } from "@/components/auth/login-showcase";

/**
 * Split login landing, Apple/Claude-style: left brand + auth card, right a
 * continuous animated product showcase. Dark/light aware via next-themes.
 */
export function LoginLanding({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex h-svh w-full flex-col overflow-y-auto bg-background text-foreground">
      <header className="material-bar relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 px-5 sm:h-16 sm:px-8">
        <BrandLockup />
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="pressable flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mounted ? isDark ? <Sun className="size-4" /> : <Moon className="size-4" /> : <span className="size-4" />}
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex w-full flex-col justify-center px-5 py-8 sm:px-10 lg:w-1/2 lg:px-10 lg:py-10 xl:px-14">
          <div className="animate-fade-in-up mx-auto w-full max-w-[380px]">
            <h1 className="text-display text-foreground">
              Voice agents,
              <br />
              live in minutes.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Build, deploy, and monitor phone agents that sound human — inbound, outbound, and
              everything in between.
            </p>

            <div className="mt-8 rounded-[1.35rem] border border-border bg-card p-5 shadow-elevated sm:p-6">
              {children}
            </div>

            <p className="mt-5 text-center text-[13px] text-muted-foreground/80">
              Trouble signing in?{" "}
              <Link to="/login" className="font-medium text-foreground underline-offset-2 hover:underline">
                Contact your workspace admin
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="flex min-h-[420px] w-full flex-col p-4 pt-0 sm:p-6 sm:pt-2 lg:min-h-0 lg:w-1/2 lg:p-5 lg:pl-3 lg:pt-2">
          <LoginShowcase className="min-h-[380px] flex-1 sm:min-h-[440px]" />
        </section>
      </main>
    </div>
  );
}
