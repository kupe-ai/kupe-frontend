import { cn } from "@/lib/utils";
import { AudioLines } from "lucide-react";

export function BrandLockup({
  className,
  collapsed,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <AudioLines className="size-4" />
      </div>
      {!collapsed && (
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-semibold tracking-tight">Kupe</div>
          <div className="truncate text-[11px] text-muted-foreground">Voice Agents</div>
        </div>
      )}
    </div>
  );
}
