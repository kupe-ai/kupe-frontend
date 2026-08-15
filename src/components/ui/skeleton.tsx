import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("relative overflow-hidden rounded-md bg-muted [animation:kupe-pulse_1.6s_ease-in-out_infinite]", className)}
      {...props}
    >
      <div className="animate-shimmer-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
    </div>
  )
}

export { Skeleton }
