"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MoreHorizontal, Pause, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { KupeIcon } from "@/components/icons/kupe-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Matrix, seededPattern } from "@/components/ui/matrix";
import { AudioPreviewProvider, useAudioPreview } from "@/lib/hooks/use-audio-preview";
import { useAuth } from "@/lib/useAuth";
import {
  cloneVoice,
  deleteVoice,
  fetchVoicePreview,
  listAllTtsVoices,
  listVoiceTtsProviders,
  updateVoice,
  type VoiceTtsProvider,
} from "@/lib/api/voice/providers";
import { friendlyVoiceError } from "@/lib/voice/friendly-error";
import { displayProviderName, formatProviderModel } from "@/lib/voice/provider-brand";
import { ProviderLogo } from "@/components/voice-agents/provider-logo";
import type { CatalogVoice } from "@/types";
import { AudioTrimSlider, sliceAudioFile } from "./audio-trim-slider";
import { TtsStudio } from "./tts-studio";

const ALL_PROVIDERS = "__all__";

export default function VoiceLibraryPage() {
  return (
    <AudioPreviewProvider>
      <VoiceLibraryPageInner />
    </AudioPreviewProvider>
  );
}

function providerFilterOptions(rows: VoiceTtsProvider[]): SearchableOption[] {
  return [
    { value: ALL_PROVIDERS, label: "All providers" },
    ...rows.map((p) => {
      const label = formatProviderModel(p.provider_name, p.model_name);
      return {
        value: p.id,
        label,
        icon: <ProviderLogo provider={p.provider_name} size="sm" />,
        keywords: `${p.provider_name} ${displayProviderName(p.provider_name)} ${p.model_name} ${label}`,
      };
    }),
  ];
}

function VoiceLibraryPageInner() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [providerId, setProviderId] = useState<string>(ALL_PROVIDERS);
  const [providers, setProviders] = useState<VoiceTtsProvider[]>([]);
  const [voices, setVoices] = useState<CatalogVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const tts = await listVoiceTtsProviders();
      setProviders(tts);
      setVoices(await listAllTtsVoices());
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
  const scoped = providerId === ALL_PROVIDERS ? voices : voices.filter((v) => v.provider_id === providerId);
  const filtered = scoped.filter((v) => {
    if (!q) return true;
    const model = formatProviderModel(v.provider_name ?? "", v.model_name ?? "").toLowerCase();
    return (
      v.voice_name.toLowerCase().includes(q) ||
      model.includes(q) ||
      (v.provider_name ?? "").toLowerCase().includes(q)
    );
  });
  const myVoices = filtered.filter((v) => v.source === "cloned" && v.user_id === userId);
  const otherVoices = filtered.filter((v) => !(v.source === "cloned" && v.user_id === userId));
  const canClone = providers.some((p) => p.provider_name.toLowerCase() === "kupe");

  return (
    <div className="voice-page voice-page-wide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title">Voice Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalog voices across every TTS provider. Samples are cached once and shared.
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
          <Button type="button" className="group/nav rounded-full" disabled={!canClone} onClick={() => setCloneOpen(true)}>
            <KupeIcon name="plus" className="size-4" />
            Clone voice
          </Button>
        </div>
      </div>

      <Tabs defaultValue="voices" className="mt-4">
        <TabsList>
          <TabsTrigger value="voices">Voices</TabsTrigger>
          <TabsTrigger value="try-tts">Try TTS</TabsTrigger>
        </TabsList>
        <TabsContent value="voices" className="mt-6 space-y-8">
          <SearchableSelect
            value={providerId}
            onChange={setProviderId}
            disabled={!providers.length}
            placeholder="All providers"
            searchPlaceholder="Search providers…"
            options={providerFilterOptions(providers)}
          />
          <VoiceSection
            title="My voices"
            description="Voices you've cloned — private by default, or shared with your workspace."
            voices={myVoices}
            loading={loading}
            isOwner
            onClone={() => setCloneOpen(true)}
            cloneDisabled={!canClone}
            onChanged={() => void refresh()}
          />
          <VoiceSection
            title="All voices"
            description="Catalog voices for every provider, plus workspace voices others have made public."
            voices={otherVoices}
            loading={loading}
            onChanged={() => void refresh()}
          />
        </TabsContent>
        <TabsContent value="try-tts" className="mt-6">
          <TtsStudio providers={providers} voices={voices} />
        </TabsContent>
      </Tabs>

      <CloneVoiceDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        onCloned={() => {
          setCloneOpen(false);
          void refresh();
        }}
      />

      {!loading && !canClone && (
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
  onClone,
  cloneDisabled,
  onChanged,
}: {
  title: string;
  description: string;
  voices: CatalogVoice[];
  loading: boolean;
  isOwner?: boolean;
  onClone?: () => void;
  cloneDisabled?: boolean;
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          {onClone ? (
            <Button
              type="button"
              className="rounded-full"
              disabled={cloneDisabled}
              onClick={onClone}
            >
              <KupeIcon name="plus" className="size-4" />
              Clone voice
            </Button>
          ) : null}
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
    setPreviewing(true);
    try {
      const url = await fetchVoicePreview(voice.id);
      player.play(voice.id, url);
    } catch (err) {
      toast.error(friendlyVoiceError(err, "Couldn't preview this voice"));
    } finally {
      setPreviewing(false);
    }
  }

  const pattern = useMemo(() => seededPattern(voice.id, 5, 5), [voice.id]);
  const providerKey = voice.provider_name ?? "";
  const modelLine =
    voice.provider_name || voice.model_name
      ? formatProviderModel(voice.provider_name ?? "", voice.model_name ?? "")
      : null;

  return (
    <div className="animate-pop-in-up flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background">
        <Matrix
          rows={5}
          cols={5}
          pattern={pattern}
          size={4.2}
          gap={1.1}
          scrambleOnHover
          className="flex size-full items-center justify-center"
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
        {modelLine ? (
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            {providerKey ? <ProviderLogo provider={providerKey} size="sm" /> : null}
            <p className="truncate text-xs text-muted-foreground">{modelLine}</p>
          </div>
        ) : null}
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
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setIsPublic(false);
      setFile(null);
      setStart(0);
      setEnd(0);
      bufferRef.current = null;
    }
  }, [open]);

  async function save() {
    if (!name.trim() || !file) {
      toast.message("Name and a sample clip are required");
      return;
    }
    setSaving(true);
    try {
      const sample = await sliceAudioFile(file, bufferRef.current, start, end);
      await cloneVoice({ name: name.trim(), isPublic, sample });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clone a voice</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reference clip</Label>
            {file ? (
              <AudioTrimSlider
                file={file}
                start={start}
                end={end}
                onChange={(nextStart, nextEnd) => {
                  setStart(nextStart);
                  setEnd(nextEnd);
                }}
                onDecoded={(buffer) => {
                  bufferRef.current = buffer;
                }}
                onClear={() => {
                  setFile(null);
                  setStart(0);
                  setEnd(0);
                  bufferRef.current = null;
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="pressable flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40"
              >
                Choose an audio file (clean speech, 30s+ recommended)
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setStart(0);
                setEnd(0);
                bufferRef.current = null;
              }}
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
