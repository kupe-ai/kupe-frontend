"use client";

import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/brand/wordmark";
import { ProductTrailer } from "@/components/auth/product-trailer";

/**
 * Claude-style split login landing — dark/light aware.
 * Left: brand + auth. Right: continuous product trailer (cream stage always).
 */
export function LoginLanding({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="login-landing flex h-full min-h-0 flex-col overflow-y-auto bg-[#f9f7f2] text-[#1d1d1c] transition-colors duration-300 dark:bg-[#0e0e0e] dark:text-[#f5f2eb]">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-center px-5 sm:h-16 sm:px-8 lg:px-10">
        <Link to="/login" className="shrink-0" aria-label="Kupe home">
          <BrandLockup height={26} />
        </Link>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          id="product"
          className="flex w-full flex-col justify-center px-5 py-8 sm:px-10 lg:w-1/2 lg:px-10 lg:py-10 xl:px-14"
        >
          <div className="mx-auto w-full max-w-[380px] animate-fade-in">
            <h1 className="text-[2rem] leading-[1.12] font-semibold tracking-tight text-[#1d1d1c] sm:text-[2.35rem] dark:text-white">
              {title ?? (
                <>
                  Voice agents,
                  <br />
                  live in minutes.
                </>
              )}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#1d1d1c]/55 dark:text-white/55">
              {description ??
                "Build, deploy, and monitor phone agents that sound human — inbound, outbound, and everything in between."}
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
