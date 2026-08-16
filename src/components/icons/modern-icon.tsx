import { KupeIcon, type KupeIconName } from "@/components/icons/kupe-icon";

/** Animated pack mark. Parent should use `group/nav`. */
export function ModernIcon({
  name,
  className,
}: {
  name: KupeIconName;
  className?: string;
}) {
  return <KupeIcon name={name} className={className} />;
}
