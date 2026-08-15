import { cn } from "@/lib/utils";

/** Brand AI mark — use everywhere instead of lucide Sparkles. */
export function AiStar({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src="/images/ai_star.svg"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden
    />
  );
}
