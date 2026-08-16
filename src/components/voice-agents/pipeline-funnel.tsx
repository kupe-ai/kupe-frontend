"use client";

import { useId } from "react";

type FunnelStage = {
  label: string;
  value: number;
};

/**
 * Tapered pipeline funnel. Each stage is a trapezoid filled with the brand
 * wash (pale → royal → navy), so conversion reads as a real funnel — not a
 * row of equal rectangles.
 */
export function PipelineFunnel({ stages }: { stages: FunnelStage[] }) {
  const uid = useId().replace(/:/g, "");
  const width = 360;
  const rowH = 48;
  const gap = 10;
  const taper = 32;
  const height = stages.length * (rowH + gap) - gap;

  return (
    <div className="mt-6 flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-md"
        role="img"
        aria-label={stages.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        <defs>
          {stages.map((_, i) => {
            const angle = i * 12;
            return (
              <linearGradient
                key={i}
                id={`${uid}-funnel-${i}`}
                x1="0"
                y1="0"
                x2={String(Math.sin((angle * Math.PI) / 180))}
                y2="1"
              >
                <stop offset="0%" stopColor="var(--primary-from)" />
                <stop offset="42%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--primary-to)" />
              </linearGradient>
            );
          })}
        </defs>
        {stages.map((stage, i) => {
          const y = i * (rowH + gap);
          const insetTop = i * taper;
          const insetBot = Math.min((i + 1) * taper, width / 2 - 24);
          const d = [
            `M ${insetTop} ${y}`,
            `L ${width - insetTop} ${y}`,
            `L ${width - insetBot} ${y + rowH}`,
            `L ${insetBot} ${y + rowH}`,
            "Z",
          ].join(" ");
          return (
            <g key={stage.label}>
              <path d={d} fill={`url(#${uid}-funnel-${i})`} />
              <text
                x={width / 2}
                y={y + rowH / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize="14"
                fontWeight="600"
              >
                {stage.value}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 grid w-full max-w-md grid-cols-3 gap-2">
        {stages.map((stage, i) => {
          const prev = i === 0 ? stage.value : stages[i - 1]!.value;
          const rate = prev > 0 ? Math.round((stage.value / prev) * 100) : 0;
          return (
            <div key={stage.label} className="text-center">
              <p className="text-xs font-medium text-foreground">{stage.label}</p>
              {i > 0 ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{rate}% from prior</p>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Top of funnel</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
