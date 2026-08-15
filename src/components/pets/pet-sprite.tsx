"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  animalFrame,
  paletteColor,
  type BodyFrame,
} from "./pet-animal-sprites";

export { seedColor } from "./pet-animal-sprites";

/** Money crosses the API as integer cents — convert only at the boundary. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Pixel dog/cat body — `size` is display height; width follows the frame aspect. */
export function PetSprite({
  seed,
  size = 20,
  frame = "stand",
  className,
  title,
  fillOverride,
  style,
}: {
  seed: string;
  size?: number;
  frame?: BodyFrame;
  className?: string;
  title?: string;
  /** When set, paints primary/light cells with this colour (status tint). */
  fillOverride?: string;
  style?: CSSProperties;
}) {
  const { pixels, palette, width, height } = animalFrame(seed, frame);
  const displayH = size;
  const displayW = Math.max(1, Math.round(size * (width / height)));

  return (
    <svg
      width={displayW}
      height={displayH}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      style={{ imageRendering: "pixelated", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {pixels.map((row, y) =>
        row.map((px, x) => {
          if (px == null) return null;
          const fill =
            fillOverride && (px === 1 || px === 2)
              ? fillOverride
              : paletteColor(palette, px);
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        }),
      )}
    </svg>
  );
}

/** Display size for a pet at a given height (matches PetSprite aspect). */
export function petDisplaySize(seed: string, height: number, frame: BodyFrame = "stand") {
  const { width, height: h } = animalFrame(seed, frame);
  return {
    width: Math.max(1, Math.round(height * (width / h))),
    height,
  };
}
