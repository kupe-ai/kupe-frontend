import { useEffect, useState } from "react";
import { BACKEND_URL } from "./config";
import type { ProviderSelection, ProvidersResponse } from "./types";

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

  if (error) return <p className="error">{error}</p>;
  if (!data || !selection) return <p className="transcript-empty">Loading providers...</p>;

  const renderSelect = (
    label: string,
    items: ProvidersResponse["model_providers"],
    value: string,
    key: keyof ProviderSelection,
  ) => (
    <label className="provider-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange({ ...selection, [key]: e.target.value })}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.provider_name} / {item.model_name}
            {item.is_default ? " (default)" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="providers-panel">
      <h2>Providers</h2>
      {renderSelect("LLM", data.model_providers, selection.llm_id, "llm_id")}
      {renderSelect("Speech-to-text", data.transcriber_providers, selection.stt_id, "stt_id")}
      {renderSelect("Text-to-speech", data.tts_providers, selection.tts_id, "tts_id")}
      <p className="provider-note">
        VAD: {data.vad_providers[0]?.model_name} (local, fixed). Selection applies to this
        session only.
      </p>
    </div>
  );
}
