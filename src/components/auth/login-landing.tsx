"use client";

import { Link, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { BrandLockup } from "@/components/brand/wordmark";
import { ProductTrailer } from "@/components/auth/product-trailer";

/**
 * Claude-style split login landing — dark/light aware.
 * Left: brand + auth. Right: continuous product trailer (cream stage always).
 */
export function LoginLanding({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [params] = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = params.get("next");
  const signupHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="login-landing flex h-full min-h-0 flex-col overflow-y-auto bg-[#f9f7f2] text-[#1d1d1c] transition-colors duration-300 dark:bg-[#0e0e0e] dark:text-[#f5f2eb]">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 px-5 sm:h-16 sm:px-8 lg:px-10">
        <Link to="/login" className="shrink-0" aria-label="Kupe home">
          <BrandLockup height={26} />
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 text-[13px] text-[#1d1d1c]/55 lg:flex dark:text-white/55"
          aria-label="Primary"
        >
          {[
            { href: "#product", label: "Product" },
            { href: "#platform", label: "Platform" },
            { href: "#voice", label: "Voice AI" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="transition-opacity hover:text-[#1d1d1c] hover:opacity-100 dark:hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex size-9 items-center justify-center rounded-full text-[#1d1d1c]/60 transition-colors hover:bg-black/5 hover:text-[#1d1d1c] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {mounted ? (
              isDark ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )
            ) : (
              <span className="size-4" />
            )}
          </button>
          <Link
            to={signupHref}
            className="kupe-hero-fill inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium text-white transition-[filter] hover:brightness-110"
          >
            Try Kupe
          </Link>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          id="product"
          className="flex w-full flex-col justify-center px-5 py-8 sm:px-10 lg:w-1/2 lg:px-10 lg:py-10 xl:px-14"
        >
          <div className="mx-auto w-full max-w-[380px] animate-fade-in">
            <h1 className="text-[2rem] leading-[1.12] font-semibold tracking-tight text-[#1d1d1c] sm:text-[2.35rem] dark:text-white">
              Voice agents,
              <br />
              live in minutes.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#1d1d1c]/55 dark:text-white/55">
              Build, deploy, and monitor phone agents that sound human — inbound,
              outbound, and everything in between.
            </p>

            <div className="mt-8 rounded-[1.35rem] border border-black/[0.06] bg-white p-5 shadow-[0_8px_30px_-18px_rgba(29,29,28,0.35)] sm:p-6 dark:border-white/10 dark:bg-[#161616] dark:shadow-none">
              {children}
            </div>

            <p className="mt-5 text-center text-[13px] text-[#1d1d1c]/45 dark:text-white/45">
              Trouble signing in?{" "}
              <span className="font-medium text-[#1d1d1c] dark:text-white">
                Contact your workspace admin
              </span>
              .
            </p>
          </div>
        </section>

        <section
          id="platform"
          className="flex min-h-[420px] w-full flex-col p-4 pt-0 sm:p-6 sm:pt-2 lg:min-h-0 lg:w-1/2 lg:p-5 lg:pl-3 lg:pt-2"
          aria-label="Product tour"
        >
          <div
            id="voice"
            className="login-showcase relative flex min-h-[380px] w-full flex-1 overflow-hidden rounded-[1.75rem] border border-[#e8e4dc] bg-[#f0eee8] sm:min-h-[440px] lg:rounded-[2rem] dark:border-transparent dark:bg-[#f4f1ea]"
          >
            <ProductTrailer className="h-full w-full" />
          </div>
        </section>
      </main>
    </div>
  );
}
