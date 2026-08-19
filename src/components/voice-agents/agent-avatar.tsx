import { useId } from "react";
import { cn } from "@/lib/utils";
import { avatarGradientForSeed } from "@/lib/agent-avatars";

export function AgentAvatar({
  seed = "kupe",
  size = 32,
  className,
  alt = "",
  muted = false,
  fade = false,
}: {
  seed?: string;
  size?: number;
  className?: string;
  alt?: string;
  /** Theme-aware sage mark with a transparent base — for hero / empty states. */
  muted?: boolean;
  /** Seed green at the top, fading to transparent at the bottom. */
  fade?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const { from, to } = avatarGradientForSeed(seed);
  const gid = `agent-av-g-${uid}`;
  const mid = `agent-av-m-${uid}`;
  const wash = muted || fade;
  const fadeFrom = "oklch(0.87 0.15 154)";
  const fadeTo = "oklch(0.63 0.19 149 / 0)";

  return (
    <span
      className={cn(
        "icon-distort",
        muted && "text-[#6f8f84] dark:text-[#a8c4bb]",
        className,
      )}
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
          <linearGradient id={gid} x1="32" y1="6" x2="32" y2="64" gradientUnits="userSpaceOnUse">
            {fade ? (
              <>
                <stop offset="0%" stopColor={fadeFrom} />
                <stop offset="38%" stopColor="oklch(0.79 0.17 152 / 0.72)" />
                <stop offset="72%" stopColor="oklch(0.68 0.18 150 / 0.22)" />
                <stop offset="100%" stopColor={fadeTo} />
              </>
            ) : wash ? (
              <>
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
                <stop offset="42%" stopColor="currentColor" stopOpacity="0.55" />
                <stop offset="76%" stopColor="currentColor" stopOpacity="0.12" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={from} stopOpacity="0.95" />
                <stop offset="52%" stopColor={to} stopOpacity="0.7" />
                <stop offset="100%" stopColor={to} stopOpacity="0" />
              </>
            )}
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
