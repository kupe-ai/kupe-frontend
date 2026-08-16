"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isMac } from "@/lib/platform";

/**
 * Fast-looping SaaS product trailer for the login showcase panel.
 * Scenes: voice agent, inbound, outbound, analytics, commands —
 * each with a guided cursor that lands on measured DOM targets.
 */

const SCENE_MS = 4200;
const ACCENT = "#4048ff";

type Scene = {
  id: string;
  label: string;
};

type CursorStep = {
  at: number;
  target?: string;
  x?: number;
  y?: number;
  hover?: string;
  click?: boolean;
};

const SCENES: Scene[] = [
  { id: "agent", label: "Agents" },
  { id: "inbound", label: "Inbound" },
  { id: "outbound", label: "Outbound" },
  { id: "analytics", label: "Analytics" },
  { id: "slash", label: "Commands" },
];

const CURSOR_SCRIPTS: Record<string, CursorStep[]> = {
  agent: [
    { at: 0, target: "prompt", hover: "prompt" },
    { at: 700, target: "approve", hover: "approve" },
    { at: 1400, target: "approve", hover: "approve", click: true },
    { at: 2200, target: "review", hover: "review" },
    { at: 2800, target: "review", hover: "review", click: true },
    { at: 3500, target: "approve", hover: "approve" },
  ],
  inbound: [
    { at: 0, target: "row-0", hover: "row-0" },
    { at: 800, target: "row-0", hover: "row-0", click: true },
    { at: 1600, target: "row-2", hover: "row-2" },
    { at: 2300, target: "row-2", hover: "row-2", click: true },
    { at: 3100, target: "badge", hover: "badge" },
  ],
  outbound: [
    { at: 0, target: "active", hover: "active" },
    { at: 700, target: "trigger-0", hover: "trigger-0" },
    { at: 1400, target: "trigger-0", hover: "trigger-0", click: true },
    { at: 2200, target: "trigger-1", hover: "trigger-1" },
    { at: 2900, target: "trigger-1", hover: "trigger-1", click: true },
  ],
  analytics: [
    { at: 0, target: "add", hover: "add" },
    { at: 700, target: "add", hover: "add", click: true },
    { at: 1500, target: "task-3", hover: "task-3" },
    { at: 2200, target: "task-3", hover: "task-3", click: true },
    { at: 3000, target: "task-2", hover: "task-2" },
  ],
  slash: [
    { at: 0, target: "input", hover: "input" },
    { at: 700, target: "input", hover: "input", click: true },
    { at: 1500, target: "cmd-0", hover: "cmd-0" },
    { at: 2200, target: "cmd-1", hover: "cmd-1" },
    { at: 2800, target: "cmd-1", hover: "cmd-1", click: true },
    { at: 3500, target: "cmd-0", hover: "cmd-0" },
  ],
};

function measureTarget(
  stage: HTMLElement,
  targetId: string,
): { x: number; y: number } | null {
  const el = stage.querySelector<HTMLElement>(
    `[data-cursor-target="${targetId}"]`,
  );
  if (!el) return null;
  const stageRect = stage.getBoundingClientRect();
  if (stageRect.width === 0 || stageRect.height === 0) return null;
  const elRect = el.getBoundingClientRect();
  return {
    x: ((elRect.left + elRect.width / 2 - stageRect.left) / stageRect.width) * 100,
    y: ((elRect.top + elRect.height / 2 - stageRect.top) / stageRect.height) * 100,
  };
}

export function ProductTrailer({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({
    x: 40,
    y: 40,
    hover: null as string | null,
    clicking: false,
    visible: false,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SCENES.length);
    }, SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      setCursor((c) => ({ ...c, visible: false }));
      return;
    }

    const scene = SCENES[index]!;
    const script = CURSOR_SCRIPTS[scene.id] ?? [];
    let cancelled = false;
    const timers: number[] = [];

    const applyStep = (step: CursorStep) => {
      if (cancelled) return;
      const stage = stageRef.current;
      let x = step.x ?? 40;
      let y = step.y ?? 40;
      if (stage && step.target) {
        const pos = measureTarget(stage, step.target);
        if (pos) {
          x = pos.x;
          y = pos.y;
        }
      }
      setCursor({
        x,
        y,
        hover: step.hover ?? step.target ?? null,
        clicking: Boolean(step.click),
        visible: true,
      });
      if (step.click) {
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            setCursor((c) => ({ ...c, clicking: false }));
          }, 220),
        );
      }
    };

    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          if (script[0]) applyStep(script[0]);
          else setCursor((c) => ({ ...c, visible: false }));
        });
      }, 80),
    );

    for (const step of script.slice(1)) {
      timers.push(
        window.setTimeout(() => {
          requestAnimationFrame(() => applyStep(step));
        }, step.at),
      );
    }

    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [index, reduceMotion]);

  const scene = SCENES[index]!;
  const hover = cursor.hover;
  const clicked = cursor.clicking;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="relative min-h-0 flex-1 px-3 pt-5 pb-2 sm:px-5 sm:pt-6 sm:pb-3">
        <div
          className="trailer-grid absolute inset-2 rounded-[1.25rem] sm:inset-3"
          aria-hidden
        />
        <div className="relative flex h-full items-center justify-center">
          <div
            ref={stageRef}
            key={scene.id}
            className="trailer-scene relative w-full max-w-[560px]"
          >
            {scene.id === "agent" && <SceneAgent hover={hover} clicked={clicked} />}
            {scene.id === "inbound" && <SceneInbound hover={hover} clicked={clicked} />}
            {scene.id === "outbound" && <SceneOutbound hover={hover} clicked={clicked} />}
            {scene.id === "analytics" && <SceneAnalytics hover={hover} clicked={clicked} />}
            {scene.id === "slash" && <SceneSlash hover={hover} clicked={clicked} />}

            {!reduceMotion && cursor.visible && (
              <TrailerCursor x={cursor.x} y={cursor.y} clicking={cursor.clicking} />
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center justify-center gap-2 pb-4 pt-1">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Show ${s.label}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index
                ? "w-6 bg-[#1d1d1c]"
                : "w-2 bg-[#1d1d1c]/25 hover:bg-[#1d1d1c]/45",
            )}
          />
        ))}
      </div>
    </div>
  );
}

const CURSOR_SIZE = 44;
const CURSOR_TIP_X = (5.5 / 24) * CURSOR_SIZE;
const CURSOR_TIP_Y = (3.5 / 24) * CURSOR_SIZE;

function TrailerCursor({
  x,
  y,
  clicking,
}: {
  x: number;
  y: number;
  clicking: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute z-30 transition-[left,top] duration-500 ease-out"
      style={{
        left: `calc(${x}% - ${CURSOR_TIP_X}px)`,
        top: `calc(${y}% - ${CURSOR_TIP_Y}px)`,
      }}
      aria-hidden
    >
      <div
        className={cn(
          "origin-top-left transition-transform duration-150",
          clicking && "scale-90",
        )}
      >
        <svg
          width={CURSOR_SIZE}
          height={CURSOR_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          className="drop-shadow-[0_3px_6px_rgba(29,29,28,0.4)]"
        >
          <path
            d="M5.5 3.5 L5.5 18.5 L9.8 14.8 L12.6 21.2 L15.1 20.1 L12.2 13.5 L17.5 13.5 Z"
            fill="#1d1d1c"
            stroke="#fff"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
        {clicking && (
          <span
            className="trailer-click-ring absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: CURSOR_TIP_X,
              top: CURSOR_TIP_Y,
              background: `${ACCENT}59`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function Win({
  title,
  children,
  className,
  trailing,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#e8e4dc] bg-white shadow-[0_12px_40px_-16px_rgba(29,29,28,0.28)]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-[#eeeae2] px-5 py-3.5">
        <div className="flex gap-1.5">
          <i className="size-3 rounded-full bg-[#e8e4dc]" />
          <i className="size-3 rounded-full bg-[#e8e4dc]" />
          <i className="size-3 rounded-full bg-[#e8e4dc]" />
        </div>
        <span className="flex-1 truncate text-center text-[15px] font-medium text-[#8a8680]">
          {title}
        </span>
        {trailing ?? <span className="w-12" />}
      </div>
      {children}
    </div>
  );
}

type SceneProps = {
  hover: string | null;
  clicked: boolean;
};

function SceneAgent({ hover, clicked }: SceneProps) {
  return (
    <div className="relative">
      <Win title="Kupe · Agent">
        <div className="flex flex-col gap-3.5 p-5 text-[16px]">
          <div
            data-cursor-target="prompt"
            className={cn(
              "rounded-xl bg-[#f6f3ed] px-4 py-3.5 text-[#3f3f3e] transition-all duration-200",
              hover === "prompt" && "ring-2 bg-[#e8eaff]",
              hover === "prompt" && "ring-[#4048ff]/35",
            )}
          >
            <span className="font-medium" style={{ color: ACCENT }}>@Kupe</span> answer inbound
            support calls, confirm appointments, and transfer to{" "}
            <span className="font-medium" style={{ color: ACCENT }}>@Aanya</span> after hours.
          </div>
          <Row ok>Voice + tools wired</Row>
          <Row ok>Knowledge base attached</Row>
          <Row warn>Waiting to go live…</Row>
        </div>
      </Win>
      <div className="absolute -right-1 -bottom-3 w-[85%]">
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-4 shadow-[0_10px_28px_-12px_rgba(29,29,28,0.35)]">
          <div className="mb-2.5 flex items-center gap-2 text-[15px] font-medium text-[#1d1d1c]">
            Deploy this agent?
          </div>
          <p className="mb-3.5 text-[14px] leading-snug text-[#6b6760]">
            Assign <b className="text-[#1d1d1c]">+1 415 555 0199</b> and start taking calls.
          </p>
          <div className="flex gap-2.5">
            <span
              data-cursor-target="review"
              className={cn(
                "rounded-lg border border-[#e8e4dc] px-4 py-2 text-[14px] font-medium text-[#6b6760] transition-all duration-200",
                hover === "review" && "scale-105 border-[#cfc9bf] bg-[#f6f3ed]",
                hover === "review" && clicked && "scale-95 bg-[#eeeae2]",
              )}
            >
              Test call
            </span>
            <span
              data-cursor-target="approve"
              className={cn(
                "rounded-lg bg-[#1d1d1c] px-4 py-2 text-[14px] font-medium text-white transition-all duration-200",
                hover === "approve" && "scale-105 bg-[#2e2e2d] shadow-md",
                hover === "approve" && clicked && "scale-95",
              )}
              style={hover === "approve" && clicked ? { background: ACCENT } : undefined}
            >
              Go live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneInbound({ hover, clicked }: SceneProps) {
  const rows = [
    { name: "Meridian Studio", sub: "Answered · 2m 14s", chip: "live", ok: true },
    { name: "Cedar & Co.", sub: "Transferred · 48s", chip: "ok", ok: true },
    { name: "Northwind Traders", sub: "Missed · voicemail", chip: "retry", ok: false },
    { name: "Habitat Living", sub: "Booked · 3m 02s", chip: "new", ok: true },
  ];
  return (
    <Win
      title="Inbound · live"
      trailing={
        <span
          data-cursor-target="badge"
          className={cn(
            "rounded-full bg-[#e8eaff] px-3 py-1 text-[13px] font-medium transition-all duration-200",
            hover === "badge" && "scale-110 ring-2 ring-[#4048ff]/25",
          )}
          style={{ color: ACCENT }}
        >
          12 today
        </span>
      }
    >
      <div className="flex flex-col gap-1.5 p-3.5">
        {rows.map((r, i) => (
          <div
            key={r.name}
            data-cursor-target={`row-${i}`}
            className={cn(
              "trailer-row flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-all duration-200",
              hover === `row-${i}` && "scale-[1.02] bg-[#f6f3ed]",
              hover === `row-${i}` && clicked && "scale-[0.99] bg-[#eeeae2]",
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-[13px]",
                r.ok ? "bg-[#e8eaff]" : "bg-[#fff1e0] text-[#b56a1a]",
              )}
              style={r.ok ? { color: ACCENT } : undefined}
            >
              {r.ok ? "✓" : "!"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-medium text-[#1d1d1c]">{r.name}</div>
              <div className="truncate text-[13px] text-[#8a8680]">{r.sub}</div>
            </div>
            <span className="rounded-full bg-[#f6f3ed] px-2.5 py-1 text-[12px] text-[#6b6760]">
              {r.chip}
            </span>
          </div>
        ))}
      </div>
    </Win>
  );
}

function SceneOutbound({ hover, clicked }: SceneProps) {
  return (
    <Win title="Outbound campaign">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-semibold text-[#1d1d1c]">Q2 renewal dials</h3>
          <span
            data-cursor-target="active"
            className={cn(
              "flex items-center gap-2 text-[15px] font-medium transition-all duration-200",
              hover === "active" && "scale-105",
            )}
            style={{ color: ACCENT }}
          >
            <span className="relative flex size-5 items-center rounded-full p-0.5" style={{ background: `${ACCENT}26` }}>
              <span className="ml-auto size-3 rounded-full" style={{ background: ACCENT }} />
            </span>
            Running
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] font-medium tracking-wide text-[#8a8680] uppercase">
            Rules
          </p>
          <div
            data-cursor-target="trigger-0"
            className={cn(
              "flex items-center gap-3 rounded-xl border border-[#eeeae2] px-4 py-3 text-[15px] text-[#3f3f3e] transition-all duration-200",
              hover === "trigger-0" && "scale-[1.02] border-[#4048ff]/50 bg-[#e8eaff]",
              hover === "trigger-0" && clicked && "scale-[0.99] border-[#4048ff]",
            )}
          >
            <span className="text-[#8a8680]">◷</span>
            Weekdays · 9:00 AM – 6:00 PM
          </div>
          <div
            data-cursor-target="trigger-1"
            className={cn(
              "flex items-center gap-3 rounded-xl border border-[#eeeae2] px-4 py-3 text-[15px] text-[#3f3f3e] transition-all duration-200",
              hover === "trigger-1" && "scale-[1.02] border-[#4048ff]/50 bg-[#e8eaff]",
              hover === "trigger-1" && clicked && "scale-[0.99] border-[#4048ff]",
            )}
          >
            <span className="text-[#8a8680]">⟳</span>
            Retry twice if no answer
            <span className="ml-auto rounded-full bg-[#fff1e0] px-2.5 py-1 text-[12px] font-medium text-[#b56a1a]">
              3x
            </span>
          </div>
        </div>
        <p className="rounded-xl bg-[#f6f3ed] px-4 py-3 text-[15px] leading-relaxed text-[#6b6760]">
          840 numbers queued · concurrency 12 · agent{" "}
          <span className="font-medium text-[#1d1d1c]">Renewals</span>.
        </p>
      </div>
    </Win>
  );
}

function SceneAnalytics({ hover, clicked }: SceneProps) {
  const tasks = [
    { name: "Answer rate 94%", done: true },
    { name: "Avg latency 410ms", done: true },
    { name: "Containment 81%", done: true },
    { name: "CSAT trending up", done: false, spin: true },
    { name: "12 transfers today", done: true },
  ];
  return (
    <Win title="Kupe">
      <div className="flex flex-col gap-1.5 p-4">
        <div className="mb-2.5 flex items-center justify-between px-1.5">
          <span className="text-[17px] font-semibold text-[#1d1d1c]">Analytics</span>
          <span
            data-cursor-target="add"
            className={cn(
              "flex size-8 items-center justify-center rounded-full bg-[#1d1d1c] text-[18px] leading-none text-white transition-all duration-200",
              hover === "add" && "scale-110 bg-[#2e2e2d] ring-2 ring-[#4048ff]/40",
              hover === "add" && clicked && "scale-90",
            )}
            style={hover === "add" && clicked ? { background: ACCENT } : undefined}
          >
            +
          </span>
        </div>
        {tasks.map((t, i) => (
          <div
            key={t.name}
            data-cursor-target={`task-${i}`}
            className={cn(
              "trailer-row flex items-center gap-3.5 rounded-xl px-3 py-3 transition-all duration-200",
              hover === `task-${i}` && "scale-[1.02] bg-[#f6f3ed]",
              hover === `task-${i}` && clicked && "scale-[0.99] bg-[#eeeae2]",
            )}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {t.spin ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-[#cfc9bf] border-t-[#1d1d1c]" />
            ) : (
              <span className="size-3.5 rounded-full" style={{ background: ACCENT }} />
            )}
            <span className="text-[16px] text-[#1d1d1c]">{t.name}</span>
          </div>
        ))}
      </div>
    </Win>
  );
}

function SceneSlash({ hover, clicked }: SceneProps) {
  return (
    <Win title={`${isMac() ? "⌘K" : "Ctrl+K"} · Kupe`}>
      <div className="flex flex-col gap-3 p-4">
        <div
          data-cursor-target="input"
          className={cn(
            "rounded-xl border border-[#eeeae2] bg-[#faf8f4] px-4 py-3.5 font-mono text-[16px] text-[#1d1d1c] transition-all duration-200",
            hover === "input" && "border-[#4048ff]/50 bg-white ring-2 ring-[#4048ff]/20",
            hover === "input" && clicked && "ring-[#4048ff]/40",
          )}
        >
          <span style={{ color: ACCENT }}>/</span>agents
          <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-[#1d1d1c] align-middle" />
        </div>
        <div className="overflow-hidden rounded-xl border border-[#eeeae2]">
          {[
            { cmd: "/agents", desc: "Open agent builder" },
            { cmd: "/inbound", desc: "Call logs" },
            { cmd: "/campaigns", desc: "Outbound" },
            { cmd: "/analytics", desc: "Performance" },
          ].map((r, i) => (
            <div
              key={r.cmd}
              data-cursor-target={`cmd-${i}`}
              className={cn(
                "trailer-row flex items-center justify-between px-4 py-3 text-[15px] transition-all duration-200",
                (hover === `cmd-${i}` || (i === 0 && !hover)) && "bg-[#f6f3ed]",
                hover === `cmd-${i}` && "scale-[1.01] bg-[#eeeae2]",
                hover === `cmd-${i}` && clicked && "bg-[#e8eaff]",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="font-mono font-medium text-[#1d1d1c]">{r.cmd}</span>
              <span className="text-[#8a8680]">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </Win>
  );
}

function Row({
  children,
  ok,
  warn,
}: {
  children: React.ReactNode;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[15px] text-[#3f3f3e]">
      <span
        className="font-medium"
        style={{ color: ok ? "#1f7a4c" : warn ? ACCENT : undefined }}
      >
        {ok ? "✓" : warn ? "▸" : "·"}
      </span>
      {children}
    </div>
  );
}
