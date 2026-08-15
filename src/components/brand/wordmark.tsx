import { cn } from "@/lib/utils";
import { AudioLines } from "lucide-react";

/** Compact mark used where a wordmark used to sit. */
export function Wordmark({
  className,
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <span className={cn("logo-in inline-flex shrink-0 items-center", className)}>
      <span
        className="flex items-center justify-center rounded-xl bg-gradient-to-br from-primary-from to-primary-to text-primary-foreground shadow-sm"
        style={{ width: height, height }}
      >
        <AudioLines style={{ width: height * 0.5, height: height * 0.5 }} />
      </span>
    </span>
  );
}

/**
 * Sidebar brand: mark alone when collapsed; mark + word when expanded.
 */
export function BrandLockup({
  className,
  collapsed,
  height = 22,
}: {
  className?: string;
  collapsed?: boolean;
  height?: number;
}) {
  const size = collapsed ? height + 6 : height + 4;
  return (
    <span className={cn("logo-in inline-flex min-w-0 items-center gap-2", className)}>
      <Wordmark height={size} />
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold tracking-tight">Kupe</span>
      )}
    </span>
  );
}
