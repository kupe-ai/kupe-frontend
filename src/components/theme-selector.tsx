"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { KupeIcon, type KupeIconName } from "@/components/icons/kupe-icon";

const OPTIONS = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
] as const satisfies readonly { value: string; label: string; icon: KupeIconName }[];

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Skeleton className={cn("h-10 w-full max-w-sm", className)} />;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {OPTIONS.map(({ value, label, icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              "group/nav flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:min-w-[7rem]",
              active
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <KupeIcon name={icon} className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
