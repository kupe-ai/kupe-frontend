"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  displayProviderName,
  providerInitials,
  providerLogoIsMono,
  providerLogoSrc,
} from "@/lib/voice/provider-brand";

export function ProviderLogo({
  provider,
  model,
  size = "md",
  className,
}: {
  provider: string;
  /** Disambiguates a multi-kind provider's brand, e.g. Sarvam's LLM
   * models (sarvam-105b, glm5.2, gemma4) show as Kai/Kupe-mark
   * while its STT/TTS models keep the Sarvam brand. */
  model?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const src = providerLogoSrc(provider, model);
  const [failed, setFailed] = useState(false);
  const label = displayProviderName(provider, model);
  const mono = providerLogoIsMono(provider, model);
  const box = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-background ring-1 ring-border",
    size === "sm" ? "size-5" : "size-6",
    className,
  );

  if (src && !failed) {
    return (
      <span className={box} title={label}>
        <img
          src={src}
          alt=""
          className={cn("size-full object-contain p-0.5", mono && "dark:invert")}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(box, "bg-muted text-[9px] font-semibold tracking-tight text-muted-foreground")}
      title={label}
      aria-hidden
    >
      {providerInitials(provider, model)}
    </span>
  );
}
