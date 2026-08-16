"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  downloadName = "kupe-tts.mp3",
  className,
}: {
  src: string;
  downloadName?: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.volume = volume;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
    // Re-bind when the clip changes; volume is applied separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }

  function seek(ratio: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2", className)}>
      <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatTime(current)} / {formatTime(duration)}
      </span>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 10)}
        onChange={(e) => seek(Number(e.target.value) / 1000)}
        className="kupe-range min-w-0 flex-1"
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
        aria-label="Seek"
      />
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <a
        href={src}
        download={downloadName}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
      >
        <Download className="size-3.5" />
        Download
      </a>
    </div>
  );
}
