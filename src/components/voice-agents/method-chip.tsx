import { cn } from "@/lib/utils";
import type { HttpMethod } from "@/lib/voice-deploy-data";

/** Mintlify-style colored HTTP method chip for API reference tables. */
const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  PATCH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function MethodChip({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-16 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight tabular-nums",
        METHOD_CLASS[method],
        className,
      )}
    >
      {method}
    </span>
  );
}
