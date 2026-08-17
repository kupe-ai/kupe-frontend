import { Skeleton } from "@/components/ui/skeleton";

export function VoiceAgentsPageShimmer() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 md:px-6 md:py-6">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-5 w-48 max-w-full" />
      </div>
      <Skeleton className="h-[200px] w-full rounded-2xl" />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-48 rounded-full" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function VoiceEditorShimmer() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[168px] shrink-0 flex-col gap-1 border-r border-border bg-pane px-2 py-3 sm:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4 px-6 py-6 md:px-10">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-[50vh] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function VoiceTableShimmer({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
