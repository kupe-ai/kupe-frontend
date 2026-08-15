import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Bot,
  Megaphone,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Auto-rotating product showcase for the login screen's right panel.
 * Five scenes — Voice AI, Agents, Campaigns, Calls, Growth — each a small
 * animated mock built from the Kupe design tokens (index.css / theme.ts).
 * No real data; purely decorative, but every motion respects
 * prefers-reduced-motion via the shared --duration-ui / --ease-spring tokens.
 */

const SCENE_MS = 4200;

type SceneId = "voice" | "agents" | "campaigns" | "calls" | "growth";

const SCENES: { id: SceneId; label: string; icon: typeof AudioLines }[] = [
  { id: "voice", label: "Voice AI", icon: AudioLines },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "growth", label: "Growth", icon: TrendingUp },
];

export function LoginShowcase({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    startRef.current = performance.now();
    function tick(now: number) {
      if (paused) {
        startRef.current = now - progress * SCENE_MS;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startRef.current;
      const pct = Math.min(1, elapsed / SCENE_MS);
      setProgress(pct);
      if (pct >= 1) {
        setActive((i) => (i + 1) % SCENES.length);
        startRef.current = now;
        setProgress(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const scene = SCENES[active].id;

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.5),transparent_40%),radial-gradient(circle_at_80%_75%,rgba(166,121,249,0.28),transparent_45%),linear-gradient(135deg,#6D5CB2_0%,#746FD1_28%,#968BF3_55%,#A379F9_78%,#CD93D9_100%)] lg:rounded-[2rem]",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <NoiseLayer />

      {/* Scene tabs */}
      <div className="relative z-10 flex shrink-0 items-center gap-1.5 p-4 sm:p-6">
        {SCENES.map((s, i) => {
          const isActive = i === active;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActive(i);
                setProgress(0);
                startRef.current = performance.now();
              }}
              className={cn(
                "group relative flex items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors duration-300",
                isActive ? "text-white" : "hover:text-white/90",
              )}
            >
              <span
                className={cn(
                  "absolute inset-0 rounded-full bg-white/12 backdrop-blur-sm transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                )}
              />
              {isActive && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                  style={{ width: `${progress * 100}%` }}
                />
              )}
              <Icon className="relative size-3.5 shrink-0" />
              <span className="relative hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-5 pt-0 sm:p-8 sm:pt-0">
        <div key={scene} className="animate-fade-in-up w-full max-w-md">
          {scene === "voice" && <VoiceScene />}
          {scene === "agents" && <AgentsScene />}
          {scene === "campaigns" && <CampaignsScene />}
          {scene === "calls" && <CallsScene />}
          {scene === "growth" && <GrowthScene />}
        </div>
      </div>

      {/* Caption */}
      <div className="relative z-10 shrink-0 px-5 pb-6 sm:px-8 sm:pb-9">
        <p className="text-[13px] font-medium text-white/80">{CAPTIONS[scene].title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">{CAPTIONS[scene].body}</p>
      </div>
    </div>
  );
}

const CAPTIONS: Record<SceneId, { title: string; body: string }> = {
  voice: {
    title: "Voice that sounds human",
    body: "Low-latency STT, LLM, and TTS pipelines tuned per agent — barge-in and turn-taking included.",
  },
  agents: {
    title: "Build agents in minutes",
    body: "Prompts, tools, variables, and knowledge bases — versioned and testable before you deploy.",
  },
  campaigns: {
    title: "Run outbound at scale",
    body: "Upload a list, set concurrency and retry rules, and let agents dial through it automatically.",
  },
  calls: {
    title: "Every call, reviewable",
    body: "Live transcripts, recordings, and post-call analysis land in one place as calls happen.",
  },
  growth: {
    title: "Watch it compound",
    body: "Answer rates, call volume, and conversions trend up as your agents learn what works.",
  },
};

function NoiseLayer() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay" aria-hidden="true">
      <filter id="login-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#login-noise)" />
    </svg>
  );
}

function Glass({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_20px_60px_-24px_rgba(5,3,5,0.55)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function VoiceScene() {
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => i), []);
  return (
    <Glass className="flex flex-col items-center gap-5 py-8">
      <div className="relative flex size-20 items-center justify-center rounded-full bg-white/15">
        <div className="absolute inset-0 animate-ping rounded-full bg-white/10" style={{ animationDuration: "2.2s" }} />
        <AudioLines className="size-8 text-white" />
      </div>
      <div className="flex h-10 items-end gap-[3px]">
        {bars.map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-white/70"
            style={{
              height: `${20 + Math.abs(Math.sin(i * 0.7)) * 60}%`,
              animation: `kupe-pulse ${0.9 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite`,
            }}
          />
        ))}
      </div>
      <p className="text-[13px] font-medium text-white/85">Listening…</p>
    </Glass>
  );
}

function AgentsScene() {
  const agents = [
    { name: "Front Desk", status: "Live", lang: "EN · HI" },
    { name: "Sales Qualifier", status: "Live", lang: "EN" },
    { name: "Support Triage", status: "Draft", lang: "EN · AR" },
  ];
  return (
    <Glass className="flex flex-col gap-2.5">
      {agents.map((a, i) => (
        <div
          key={a.name}
          className="animate-fade-in-up flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5"
          style={{ animationDelay: `${i * 110}ms` }}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <Bot className="size-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">{a.name}</div>
            <div className="truncate text-[11px] text-white/55">{a.lang}</div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              a.status === "Live" ? "bg-emerald-400/25 text-emerald-100" : "bg-white/15 text-white/70",
            )}
          >
            {a.status}
          </span>
        </div>
      ))}
    </Glass>
  );
}

function CampaignsScene() {
  return (
    <Glass className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-white">Renewal outreach</div>
          <div className="text-[11px] text-white/55">4,281 contacts</div>
        </div>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/80">Running</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-white/80"
          style={{ width: "62%", transition: "width 1.2s var(--ease-spring)" }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["2,652", "Dialed"],
          ["1,410", "Answered"],
          ["338", "Converted"],
        ].map(([n, l]) => (
          <div key={l} className="rounded-xl bg-white/10 py-2.5">
            <div className="text-[15px] font-semibold text-white">{n}</div>
            <div className="text-[10px] text-white/55">{l}</div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

function CallsScene() {
  const calls = [
    { dir: "in", num: "+91 98••• 4471", dur: "2:14" },
    { dir: "out", num: "+1 415••• 0192", dur: "0:47" },
    { dir: "in", num: "+44 7•••• 8823", dur: "4:02" },
  ];
  return (
    <Glass className="flex flex-col gap-2">
      {calls.map((c, i) => (
        <div
          key={i}
          className="animate-fade-in-up flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5"
          style={{ animationDelay: `${i * 110}ms` }}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
            {c.dir === "in" ? (
              <PhoneIncoming className="size-4 text-white" />
            ) : (
              <PhoneOutgoing className="size-4 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1 truncate text-[13px] text-white/90">{c.num}</div>
          <div className="shrink-0 text-[11px] tabular-nums text-white/55">{c.dur}</div>
        </div>
      ))}
    </Glass>
  );
}

function GrowthScene() {
  const vals = [28, 34, 31, 42, 46, 52, 61, 58, 68, 74, 71, 82];
  return (
    <Glass className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[22px] font-semibold tracking-tight text-white">+186%</div>
        <div className="text-[11px] text-white/55">answered calls · 90d</div>
      </div>
      <div className="flex h-20 items-end gap-1.5">
        {vals.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-white/70"
            style={{
              height: `${v}%`,
              animation: `kupe-fade-in-up 600ms var(--ease-spring) both`,
              animationDelay: `${i * 45}ms`,
            }}
          />
        ))}
      </div>
    </Glass>
  );
}
