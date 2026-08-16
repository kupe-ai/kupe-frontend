import { cn } from "@/lib/utils";

const LIGHT_SRC = "/brand/kupe-light.png";
const DARK_SRC = "/brand/kupe-dark.png";
const MARK_SRC = "/brand/kupe-mark.png";

/** iOS-style squircle mark — used as favicon and collapsed sidebar logo. */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={MARK_SRC}
      alt="kupe"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

function KupeLogoImg({
  height,
  className,
}: {
  height: number;
  className?: string;
}) {
  const width = Math.round(height * (382 / 157));
  return (
    <span
      className={cn("logo-in relative inline-flex shrink-0 items-center", className)}
      style={{ height }}
    >
      <img
        src={LIGHT_SRC}
        alt="kupe"
        height={height}
        width={width}
        className="block w-auto max-w-none object-contain object-left dark:hidden"
        style={{ height, width }}
        draggable={false}
      />
      <img
        src={DARK_SRC}
        alt=""
        height={height}
        width={width}
        className="hidden w-auto max-w-none object-contain object-left dark:block"
        style={{ height, width }}
        draggable={false}
        aria-hidden
      />
    </span>
  );
}

/** Compact mark used where a wordmark used to sit. */
export function Wordmark({
  className,
  height = 28,
}: {
  className?: string;
  height?: number;
}) {
  return <KupeLogoImg height={height} className={className} />;
}

/**
 * Sidebar / header brand: the kupe wordmark image.
 * Light (image 2) and dark (image 3) swap with the theme class.
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
  if (collapsed) {
    return <BrandMark size={28} className={className} />;
  }
  return <KupeLogoImg height={height + 6} className={className} />;
}
