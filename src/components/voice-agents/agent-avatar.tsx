import { cn } from "@/lib/utils";
import { avatarSrcForSeed } from "@/lib/agent-avatars";

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
  return (
    <img
      src={avatarSrcForSeed(seed)}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full bg-muted object-cover object-top", className)}
    />
  );
}
