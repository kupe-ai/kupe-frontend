import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Minimal single-track audio preview player, shared app-wide via context so
 * only one preview clip ever plays at a time (e.g. voice-sample rows in
 * KupeVoicePicker). Deliberately small — a full-featured player (scrubber,
 * speed control, volume) isn't needed for a short preview-play button.
 */

interface AudioPreviewContextValue {
  activeId: string | null;
  isPlaying: boolean;
  play: (id: string, src: string) => void;
  pause: () => void;
  isItemActive: (id: string) => boolean;
}

const AudioPreviewContext = createContext<AudioPreviewContextValue | null>(null);

export function AudioPreviewProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.pause();
    };
  }, []);

  const play = useCallback((id: string, src: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeId !== id || audio.src !== src) {
      audio.src = src;
      setActiveId(id);
    }
    void audio.play();
    setIsPlaying(true);
  }, [activeId]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const isItemActive = useCallback((id: string) => activeId === id, [activeId]);

  const value = useMemo(
    () => ({ activeId, isPlaying, play, pause, isItemActive }),
    [activeId, isPlaying, play, pause, isItemActive],
  );

  return <AudioPreviewContext.Provider value={value}>{children}</AudioPreviewContext.Provider>;
}

export function useAudioPreview() {
  const ctx = useContext(AudioPreviewContext);
  if (!ctx) throw new Error("useAudioPreview must be used within AudioPreviewProvider");
  return ctx;
}
