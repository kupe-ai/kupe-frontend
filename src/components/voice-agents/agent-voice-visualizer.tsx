"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Custom Voice AI visualizer for Test Agent calls.
 * Driven by a 0–1 amplitude from the remote agent audio track
 * (see livekit-web-call onAgentAudioLevel) — not the local mic.
 */
export function AgentVoiceVisualizer({
  level,
  active,
  processing,
  className,
}: {
  level: number;
  active?: boolean;
  processing?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  const rafRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const barCount = 32;
    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const amp = active ? Math.max(0.06, levelRef.current) : 0.06;
      phaseRef.current += processing ? 0.08 : 0.04;
      const gap = 3;
      const barW = Math.max(2, (w - gap * (barCount - 1)) / barCount);
      const styles = getComputedStyle(canvas);
      const colors = [
        styles.getPropertyValue("--kupe-purple-deep").trim() || "#6D5CB2",
        styles.getPropertyValue("--kupe-purple-hover").trim() || "#968BF3",
        styles.getPropertyValue("--kupe-purple-bright").trim() || "#A379F9",
        "#CD93D9",
        styles.getPropertyValue("--kupe-pink").trim() || "#FAACDB",
      ];

      for (let i = 0; i < barCount; i++) {
        const t = i / (barCount - 1);
        const envelope = 1 - Math.abs(t - 0.5) * 1.4;
        const wave = Math.sin(phaseRef.current + i * 0.45) * 0.35 + 0.65;
        const idle = processing ? 0.25 + 0.2 * Math.sin(phaseRef.current * 1.5 + i * 0.3) : 0.08;
        const height = Math.max(4, h * (active ? amp * envelope * wave : idle));
        const x = i * (barW + gap);
        const y = (h - height) / 2;
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = active ? 0.85 : 0.35;
        ctx.beginPath();
        const r = Math.min(barW / 2, 2);
        ctx.roundRect(x, y, barW, height, r);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [active, processing]);

  return (
    <div className={cn("relative h-16 w-full max-w-[240px]", className)}>
      <canvas ref={canvasRef} className="size-full" aria-hidden />
    </div>
  );
}
