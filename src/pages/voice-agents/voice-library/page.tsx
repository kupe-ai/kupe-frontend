"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, MoreHorizontal, Pause, Play, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AiStar } from "@/components/brand/ai-star";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Matrix, seededPattern } from "@/components/ui/matrix";
import { AudioPreviewProvider, useAudioPreview } from "@/lib/hooks/use-audio-preview";
import { useAuth } from "@/lib/useAuth";
import {
  cloneVoice,
  deleteVoice,
  getKupeVoiceProvider,
  listVoiceTtsVoices,
  speakVoicePreview,
  updateVoice,
} from "@/lib/api/voice/providers";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import type { CatalogVoice } from "@/types";

export default function VoiceLibraryPage() {
  return (
    <AudioPreviewProvider>
      <VoiceLibraryPageInner />
    </AudioPreviewProvider>
  );
}

function VoiceLibraryPageInner() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [providerId, setProviderId] = useState<string | null>(null);
  const [voices, setVoices] = useState<CatalogVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const provider = await getKupeVoiceProvider();
      if (!provider) {
        setVoices([]);
        return;
      }
      setProviderId(provider.id);
      setVoices(await listVoiceTtsVoices(provider.id));
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't load the voice library"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = search.trim().toLowerCase();
  const filtered = voices.filter((v) => !q || v.voice_name.toLowerCase().includes(q));
  const myVoices = filtered.filter((v) => v.source === "cloned" && v.user_id === userId);
  const otherVoices = filtered.filter((v) => !(v.source === "cloned" && v.user_id === userId));

  return (
    <div className="voice-page voice-page-wide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title">Voice Library</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Explore every voice available to your agents, try text-to-speech, and clone your own —
            keep clones private to you or share them with your whole workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices"
              className="h-9 w-48 rounded-full pl-8"
            />
          </div>
          <Button type="button" className="rounded-full" onClick={() => setCloneOpen(true)}>
            <Plus className="size-4" />
            Clone voice
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <TtsPlayground voices={voices} />
      </div>

      <div className="mt-10 space-y-8">
        <VoiceSection
          title="My voices"
          description="Voices you've cloned — private by default, or shared with your workspace."
          voices={myVoices}
          loading={loading}
          isOwner
          onChanged={refresh}
        />
        <VoiceSection
          title="All voices"
          description="Built-in Kupe voices, plus workspace voices others have made public."
          voices={otherVoices}
          loading={loading}
          onChanged={refresh}
        />
      </div>

      <CloneVoiceDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onCloned={() => {
          setCloneOpen(false);
          void refresh();
        }}
      />

      {!loading && !providerId && (
        <p className="mt-4 text-sm text-muted-foreground">
          Voice cloning isn't set up on this workspace yet — ask an admin to add a platform API key.
        </p>
      )}
    </div>
  );
}

function VoiceSection({
  title,
  description,
  voices,
  loading,
  isOwner,
  onChanged,
}: {
  title: string;
  description: string;
  voices: CatalogVoice[];
  loading: boolean;
  isOwner?: boolean;
  onChanged: () => void;
}) {
  return (
    <section>
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : voices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {voices.map((v) => (
            <VoiceCard key={v.id} voice={v} isOwner={isOwner} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function VoiceCard({
  voice,
  isOwner,
  onChanged,
}: {
  voice: CatalogVoice;
  isOwner?: boolean;
  onChanged: () => void;
}) {
  const player = useAudioPreview();
  const [previewing, setPreviewing] = useState(false);
  const isPlaying = player.isItemActive(voice.id) && player.isPlaying;

  async function togglePreview() {
    if (isPlaying) {
      player.pause();
      return;
    }
    if (voice.preview_url) {
      player.play(voice.id, voice.preview_url);
      return;
    }
    setPreviewing(true);
    try {
      const blob = await speakVoicePreview(voice.id, `Hi, I'm ${voice.voice_name}.`);
      player.play(voice.id, URL.createObjectURL(blob));
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't preview this voice"));
    } finally {
      setPreviewing(false);
    }
  }

  const pattern = useMemo(() => seededPattern(voice.id), [voice.id]);

  return (
    <div className="animate-pop-in-up flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
        <Matrix
          rows={7}
          cols={7}
          pattern={pattern}
          size={3}
          gap={0.8}
          palette={{ on: "var(--primary)", off: "transparent" }}
          ariaLabel=""
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{voice.voice_name}</p>
          {voice.source === "cloned" && (
            <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
              Cloned
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {voice.gender && <span className="capitalize">{voice.gender}</span>}
          {voice.supported_languages.slice(0, 2).map((l) => (
            <span key={l} className="rounded-full bg-muted px-1.5 py-0.5 uppercase">
              {l}
            </span>
          ))}
          {voice.source === "cloned" && (
            <span
              className={
                voice.is_public
                  ? "rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400"
                  : "rounded-full bg-muted px-1.5 py-0.5"
              }
            >
              {voice.is_public ? "Public" : "Private"}
            </span>
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-full"
        onClick={() => void togglePreview()}
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
        disabled={previewing}
      >
        {previewing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4" />
        )}
      </Button>

      {isOwner && voice.source === "cloned" && (
        <VoiceCardMenu voice={voice} onChanged={onChanged} />
      )}
    </div>
  );
}

function VoiceCardMenu({ voice, onChanged }: { voice: CatalogVoice; onChanged: () => void }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(voice.voice_name);
  const [saving, setSaving] = useState(false);

  async function toggleVisibility() {
    try {
      await updateVoice(voice.id, { isPublic: !voice.is_public });
      toast.success(voice.is_public ? "Made private" : "Made public");
      onChanged();
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't update visibility"));
    }
  }

  async function saveRename() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateVoice(voice.id, { name: name.trim() });
      setRenameOpen(false);
      onChanged();
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't rename this voice"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await deleteVoice(voice.id);
      toast.success("Voice deleted");
      onChanged();
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't delete this voice"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="More">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void toggleVisibility()}>
            {voice.is_public ? "Make private" : "Make public"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void remove()} className="text-destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename voice</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void saveRename()} loading={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CloneVoiceDialog({
  open,
  onOpenChange,
  onCloned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned: () => void;
}) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setIsPublic(false);
      setFile(null);
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !file) {
      toast.message("Name and a sample clip are required");
      return;
    }
    setSaving(true);
    try {
      await cloneVoice({ name: name.trim(), isPublic, sample: file });
      toast.success("Voice cloned");
      onCloned();
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't clone this voice"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clone a voice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" />
          </div>
          <div className="space-y-1.5">
            <Label>Reference clip</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="pressable flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40"
            >
              {file ? file.name : "Choose an audio file (clean speech, 30s+ recommended)"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Make public</p>
              <p className="text-xs text-muted-foreground">Visible to everyone in this workspace.</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" onClick={() => void save()} loading={saving}>
            Clone voice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TtsPlayground({ voices }: { voices: CatalogVoice[] }) {
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState("Hi, thanks for calling — how can I help you today?");
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!voiceId && voices.length > 0) setVoiceId(voices[0]!.voice_id);
  }, [voices, voiceId]);

  async function generate() {
    const voice = voices.find((v) => v.voice_id === voiceId);
    if (!voice || !text.trim()) return;
    setGenerating(true);
    try {
      const blob = await speakVoicePreview(voice.id, text.trim());
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      requestAnimationFrame(() => audioRef.current?.play());
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't generate speech"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <AiStar size={16} />
        <p className="text-sm font-semibold">Try text-to-speech</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Type something for the voice to say…"
        />
        <div className="flex flex-col gap-2 sm:w-48">
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.voice_id}>
                {v.voice_name}
              </option>
            ))}
          </select>
          <Button type="button" className="rounded-full" onClick={() => void generate()} loading={generating}>
            Generate
          </Button>
        </div>
      </div>
      {audioUrl && (
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
          <audio ref={audioRef} controls src={audioUrl} className="h-9 flex-1" />
          <a
            href={audioUrl}
            download={`kupe-voice-preview.mp3`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Download className="size-3.5" />
            Download
          </a>
        </div>
      )}
    </div>
  );
}
