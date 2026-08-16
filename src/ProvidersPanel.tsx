import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/config";
import type { ProviderSelection, ProvidersResponse } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { displayModelName, displayProviderName } from "@/lib/voice/provider-brand";
import { ProviderLogo } from "@/components/voice-agents/provider-logo";

type Props = {
  selection: ProviderSelection | null;
  onChange: (next: ProviderSelection) => void;
};

export default function ProvidersPanel({ selection, onChange }: Props) {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/v1/providers`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((res: ProvidersResponse) => {
        setData(res);
        if (!selection) {
          onChange(res.defaults ?? res.selected);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load providers"));
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data || !selection) {
    return <p className="text-sm text-muted-foreground">Loading providers…</p>;
  }

  const renderSelect = (
    label: string,
    items: ProvidersResponse["model_providers"],
    value: string,
    key: keyof ProviderSelection,
  ) => (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <SearchableSelect
        value={value}
        onChange={(v) => onChange({ ...selection, [key]: v })}
        placeholder={`Select ${label}`}
        searchPlaceholder={`Search ${label}…`}
        className="w-full"
        options={items.map((item) => {
          const label = displayModelName(item.model_name);
          return {
            value: item.id,
            label,
            icon: <ProviderLogo provider={item.provider_name} size="sm" />,
            keywords: `${item.provider_name} ${displayProviderName(item.provider_name)} ${item.model_name} ${label}`,
            hint: item.is_default ? "default" : undefined,
          };
        })}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {renderSelect("LLM", data.model_providers, selection.llm_id, "llm_id")}
      {renderSelect("Speech-to-text", data.transcriber_providers, selection.stt_id, "stt_id")}
      {renderSelect("Text-to-speech", data.tts_providers, selection.tts_id, "tts_id")}
      <p className="text-xs text-muted-foreground">
        VAD: {data.vad_providers[0]?.model_name} (local, fixed). Selection applies to this session only.
      </p>
    </div>
  );
}
