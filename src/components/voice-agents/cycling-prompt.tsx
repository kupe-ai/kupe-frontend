"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PREFIX = "Create a voice agent";

const SUFFIXES = [
  "to answer calls and confirm appointments",
  "that qualifies inbound leads",
  "to collect EMI payments on time",
  "for appointment reminders",
  "that handles support after hours",
  "to recover overdue invoices",
];

export function CyclingPromptPlaceholder({ paused }: { paused: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SUFFIXES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 text-sm text-muted-foreground md:text-base">
      <span className="shrink-0">{PREFIX}&nbsp;</span>
      <span className="relative h-[1.25em] min-w-0 flex-1 overflow-hidden">
        <span
          key={index}
          className={cn("absolute inset-x-0 truncate", !paused && "animate-prompt-cycle")}
        >
          {SUFFIXES[index]}
        </span>
      </span>
    </span>
  );
}
