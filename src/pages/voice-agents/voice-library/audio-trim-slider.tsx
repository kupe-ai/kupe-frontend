"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_CLIP_SEC = 0.5;
const FULL_FILE_SLOP = 0.08;
const PX_PER_SEC = 32;
const MIN_BAR_PX = 3;
const BAR_GAP_PX = 1;
const MIN_BARS = 48;
const MAX_BARS = 360;

function trackWidthFor(duration: number, containerWidth: number): number {
  if (!containerWidth) return 0;
  if (!duration) return containerWidth;
  return Math.max(containerWidth, Math.round(duration * PX_PER_SEC));
}

function barCountFor(trackWidth: number): number {
  if (trackWidth <= 0) return MIN_BARS;
  return Math.max(
    MIN_BARS,
    Math.min(MAX_BARS, Math.floor(trackWidth / (MIN_BAR_PX + BAR_GAP_PX))),
  );
}

export function formatClipTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function sliceAudioFile(
  file: File,
  buffer: AudioBuffer | null,
  start: number,
  end: number,
): Promise<File> {
  if (!buffer) return file;
  const duration = buffer.duration;
  if (start <= FULL_FILE_SLOP && end >= duration - FULL_FILE_SLOP) return file;
  const blob = encodeWavSlice(buffer, start, end);
  const base = file.name.replace(/\.[^.]+$/, "") || "sample";
  return new File([blob], `${base}.wav`, { type: "audio/wav" });
}

function encodeWavSlice(buffer: AudioBuffer, startSec: number, endSec: number): Blob {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const from = Math.max(0, Math.floor(startSec * rate));
  const to = Math.min(buffer.length, Math.floor(endSec * rate));
  const samples = Math.max(1, to - from);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const chans = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][from + i] ?? 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function computePeaks(buffer: AudioBuffer, bars: number): number[] {
  const data = buffer.getChannelData(0);
  const perBar = Math.max(1, Math.floor(data.length / bars));
  const peaks = new Array<number>(bars);
  let peak = 0.01;
  for (let i = 0; i < bars; i++) {
    let max = 0;
    const from = i * perBar;
    const to = Math.min(data.length, from + perBar);
    for (let j = from; j < to; j++) {
      const v = Math.abs(data[j] ?? 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
    if (max > peak) peak = max;
  }
  return peaks.map((p) => p / peak);
}

type Handle = "start" | "end";

export function AudioTrimSlider({
  file,
  start,
  end,
  onChange,
  onDecoded,
  onClear,
}: {
  file: File;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onDecoded: (buffer: AudioBuffer | null) => void;
  onClear?: () => void;
}) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Handle | null>(null);
  const rangeRef = useRef({ start, end });
  rangeRef.current = { start, end };

  const trackWidth = trackWidthFor(duration, containerWidth);
  const barCount = barCountFor(trackWidth);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const apply = () => {
      const style = getComputedStyle(el);
      const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      setContainerWidth(Math.max(0, Math.round(el.clientWidth - pad)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audioRef.current = audio;
    bufferRef.current = null;
    setLoading(true);
    setFailed(false);
    setPeaks(null);
    setDuration(0);
    setPlaying(false);
    setPlayhead(null);
    onDecoded(null);

    const ctx = new AudioContext();
    void file
      .arrayBuffer()
      .then((bytes) => ctx.decodeAudioData(bytes.slice(0)))
      .then((buffer) => {
        if (cancelled) return;
        bufferRef.current = buffer;
        setDuration(buffer.duration);
        onDecoded(buffer);
        onChange(0, buffer.duration);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          onDecoded(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      audio.pause();
      audioRef.current = null;
      bufferRef.current = null;
      URL.revokeObjectURL(url);
      void ctx.close();
    };
    // Decode once per file; parent callbacks are stable enough for this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    const buffer = bufferRef.current;
    if (!buffer || !barCount) return;
    setPeaks(computePeaks(buffer, barCount));
  }, [barCount, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      const { start: from, end: to } = rangeRef.current;
      const t = audio.currentTime;
      if (t >= to - 0.02) {
        audio.pause();
        audio.currentTime = from;
        setPlaying(false);
        setPlayhead(null);
        return;
      }
      setPlayhead(t);
    };
    const onEnded = () => {
      setPlaying(false);
      setPlayhead(null);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [file]);

  const minGap = useMemo(
    () => Math.min(MIN_CLIP_SEC, Math.max(0.15, duration * 0.04)),
    [duration],
  );

  const applyHandle = useCallback(
    (handle: Handle, time: number) => {
      if (!duration) return;
      const { start: from, end: to } = rangeRef.current;
      const t = Math.max(0, Math.min(duration, time));
      if (handle === "start") onChange(Math.min(t, to - minGap), to);
      else onChange(from, Math.max(t, from + minGap));
    },
    [duration, minGap, onChange],
  );

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !duration) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  function onTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!duration) return;
    e.preventDefault();
    const t = timeFromClientX(e.clientX);
    const handle: Handle = Math.abs(t - start) <= Math.abs(t - end) ? "start" : "end";
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = handle;
    applyHandle(handle, t);
    audioRef.current?.pause();
    setPlaying(false);
    setPlayhead(null);
  }

  function onTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    applyHandle(dragRef.current, timeFromClientX(e.clientX));
  }

  function onTrackPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    dragRef.current = null;
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setPlayhead(null);
      return;
    }
    audio.currentTime = start;
    try {
      await audio.play();
      setPlaying(true);
      setPlayhead(start);
    } catch {
      setPlaying(false);
    }
  }

  const startPct = duration ? (start / duration) * 100 : 0;
  const endPct = duration ? (end / duration) * 100 : 100;
  const playPct = playhead != null && duration ? (playhead / duration) * 100 : null;
  const selected = Math.max(0, end - start);

  return (
    <div
      ref={shellRef}
      className="min-w-0 w-full overflow-hidden rounded-xl border border-border bg-muted/20 p-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full"
            onClick={onClear}
            aria-label="Remove clip"
          >
            <X />
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 flex h-28 items-center justify-center rounded-lg bg-background/60">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : failed ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Couldn't preview this clip — we'll still clone the original file.
        </p>
      ) : (
        <div className="mt-3 flex min-w-0 flex-col gap-2">
          <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-1">
            <div className="px-2" style={{ width: trackWidth ? trackWidth + 16 : "100%" }}>
              <div
                ref={trackRef}
                className="relative cursor-ew-resize touch-none select-none"
                style={{ width: trackWidth || "100%" }}
                onPointerDown={onTrackPointerDown}
                onPointerMove={onTrackPointerMove}
                onPointerUp={onTrackPointerUp}
                onPointerCancel={onTrackPointerUp}
              >
              <div className="relative h-24 overflow-hidden rounded-lg bg-background ring-1 ring-border">
                <div className="absolute inset-0 flex items-center gap-px px-2">
                  {(peaks ?? []).map((p, i) => {
                    const count = peaks?.length || barCount;
                    const t = ((i + 0.5) / count) * duration;
                    const active = t >= start && t <= end;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "min-w-0 flex-1 rounded-full",
                          active ? "bg-primary" : "bg-foreground/12",
                        )}
                        style={{ height: `${Math.max(10, p * 88)}%` }}
                      />
                    );
                  })}
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 bg-primary/12"
                  style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
                  style={{ left: `${startPct}%` }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
                  style={{ left: `${endPct}%` }}
                />
                {playPct != null ? (
                  <div
                    className="pointer-events-none absolute top-1 bottom-1 w-px rounded-full bg-white shadow-[0_0_8px_rgb(255_255_255_/_0.7)]"
                    style={{ left: `${playPct}%` }}
                  />
                ) : null}
              </div>

              <div className="relative mt-3 h-5">
                <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-foreground/10" />
                <div
                  className="kupe-hero-fill absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                  style={{ left: `${startPct}%`, width: `${Math.max(1.5, endPct - startPct)}%` }}
                />
                <Thumb pct={startPct} label="Trim start" time={formatClipTime(start)} />
                <Thumb pct={endPct} label="Trim end" time={formatClipTime(end)} />
              </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{formatClipTime(start)}</span>
            <span>{formatClipTime(end)}</span>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => void togglePlay()}
              aria-label={playing ? "Pause clip" : "Play selected clip"}
            >
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause" : "Play"}
            </Button>
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {formatClipTime(selected)} selected
              {duration >= 30 && selected < 30 ? " · 30s+ recommended" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({ pct, label, time }: { pct: number; label: string; time: string }) {
  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={time}
      className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-white shadow-[0_1px_4px_rgb(0_0_0_/_0.28)] ring-2 ring-primary dark:border-white/20 dark:bg-zinc-50"
      style={{ left: `${pct}%` }}
    />
  );
}
