import type { Icon, IconWeight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Phosphor duotone mark with a hover warp. Parent should use `group/nav`. */
export function ModernIcon({
  icon: Icon,
  className,
  weight = "duotone",
}: {
  icon: Icon;
  className?: string;
  weight?: IconWeight;
}) {
  return (
    <span className="inline-flex origin-center [transform-box:fill-box] hover:animate-icon-distort group-hover/nav:animate-icon-distort">
      <Icon weight={weight} className={cn("size-4 shrink-0", className)} />
    </span>
  );
}
