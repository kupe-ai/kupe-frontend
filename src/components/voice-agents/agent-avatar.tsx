import { useId } from "react";
import { cn } from "@/lib/utils";
import { avatarGradientForSeed } from "@/lib/agent-avatars";

export function AgentAvatar({
  seed,
  size = 32,
  className,
  alt = "",
}: {
  seed: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const { from, to } = avatarGradientForSeed(seed);
  const gid = `agent-av-g-${uid}`;
  const mid = `agent-av-m-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={alt ? "img" : "presentation"}
      aria-label={alt || undefined}
    >
      <defs>
        <linearGradient id={gid} x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <mask id={mid} maskUnits="userSpaceOnUse">
          <rect width="64" height="64" fill="black" />
          <g fill="white">
            <rect x="16" y="20" width="32" height="28" rx="12" />
            <circle cx="22" cy="16" r="9" />
            <circle cx="32" cy="11" r="11" />
            <circle cx="42" cy="16" r="9" />
            <circle cx="12" cy="33" r="9" />
            <circle cx="52" cy="33" r="9" />
            <circle cx="22" cy="50" r="9" />
            <circle cx="42" cy="50" r="9" />
            <rect x="20" y="40" width="24" height="12" rx="8" />
          </g>
          <rect x="22.5" y="27" width="7" height="16" rx="3.5" fill="black" />
          <rect x="34.5" y="27" width="7" height="16" rx="3.5" fill="black" />
        </mask>
      </defs>
      <rect width="64" height="64" fill={`url(#${gid})`} mask={`url(#${mid})`} />
    </svg>
  );
}
