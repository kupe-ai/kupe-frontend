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
    <span
      className={cn("icon-distort", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="overflow-visible"
        role={alt ? "img" : "presentation"}
        aria-label={alt || undefined}
      >
        <defs>
          <linearGradient id={gid} x1="32" y1="6" x2="32" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={from} stopOpacity="0.95" />
            <stop offset="52%" stopColor={to} stopOpacity="0.7" />
            <stop offset="100%" stopColor={to} stopOpacity="0" />
          </linearGradient>
          <mask id={mid} maskUnits="userSpaceOnUse">
            <rect width="64" height="64" fill="black" />
            <g fill="white">
              <circle cx="22" cy="18" r="10" />
              <circle cx="32" cy="14" r="12" />
              <circle cx="42" cy="18" r="10" />
              <rect x="16" y="20" width="32" height="26" rx="14" />
              <circle cx="13" cy="34" r="9" />
              <circle cx="51" cy="34" r="9" />
              <circle cx="22" cy="50" r="10" />
              <circle cx="42" cy="50" r="10" />
            </g>
            <rect x="23" y="28" width="6.5" height="15" rx="3.25" fill="black" />
            <rect x="34.5" y="28" width="6.5" height="15" rx="3.25" fill="black" />
          </mask>
        </defs>
        <rect width="64" height="64" fill={`url(#${gid})`} mask={`url(#${mid})`} />
      </svg>
    </span>
  );
}
