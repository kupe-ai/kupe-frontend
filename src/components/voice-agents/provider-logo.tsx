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
  size = "md",
  className,
}: {
  provider: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const src = providerLogoSrc(provider);
  const [failed, setFailed] = useState(false);
  const label = displayProviderName(provider);
  const mono = providerLogoIsMono(provider);
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
      {providerInitials(provider)}
    </span>
  );
}
