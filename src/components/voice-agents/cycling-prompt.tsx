"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_PREFIX = "Create a voice agent";

const DEFAULT_SUFFIXES = [
  "to answer calls and confirm appointments",
  "that qualifies inbound leads",
  "to collect EMI payments on time",
  "for appointment reminders",
  "that handles support after hours",
  "to recover overdue invoices",
];

export function CyclingPromptPlaceholder({
  paused,
  prefix = DEFAULT_PREFIX,
  suffixes = DEFAULT_SUFFIXES,
}: {
  paused: boolean;
  prefix?: string;
  suffixes?: string[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % suffixes.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [paused, suffixes.length]);

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 text-left text-sm text-muted-foreground md:text-base">
      <span className="whitespace-nowrap">{prefix}&nbsp;</span>
      <span className="relative h-[1.25em] overflow-hidden">
        <span
          key={index}
          className={cn("block whitespace-nowrap", !paused && "animate-prompt-cycle")}
        >
          {suffixes[index]}
        </span>
      </span>
    </span>
  );
}
