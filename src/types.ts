export type ProviderOption = {
  id: string;
  provider_name: string;
  model_name: string;
  is_default?: boolean;
  default_voice?: string;
};

export type ProviderSelection = {
  llm_id: string;
  stt_id: string;
  tts_id: string;
};

export type ProvidersResponse = {
  model_providers: ProviderOption[];
  transcriber_providers: ProviderOption[];
  tts_providers: ProviderOption[];
  vad_providers: ProviderOption[];
  defaults: ProviderSelection;
  selected?: ProviderSelection;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Project = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
};

export type CreateSessionBody = ProviderSelection & {
  org_id: string;
  project_id: string;
  transport?: "livekit" | "realtime_ws";
  record?: boolean;
};

export type SessionInfo = {
  session_id: string;
  org_id: string;
  project_id: string;
  transport: string;
  status: string;
  room_name: string | null;
  ws_url: string | null;
  token: string | null;
  created_at: string;
  ended_at: string | null;
};

export type UsageSummaryRow = {
  metric_type: string;
  provider_name: string;
  model_name: string;
  total_quantity: number;
};

export type Recording = {
  id: string;
  session_id: string;
  status: string;
  storage_path: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
};

export type TTFBEntry = {
  processor: string;
  model: string | null;
  value_ms: number;
};

export type LatencyMessage =
  | { kind: "latency"; type: "perceived_response"; value_ms: number }
  | { kind: "latency"; type: "time_to_first_greeting"; value_ms: number }
  | {
      kind: "latency";
      type: "breakdown";
      user_turn_ms: number | null;
      ttfb: TTFBEntry[];
      text_aggregation_ms: number | null;
    };

export type TranscriptMessage = {
  kind: "transcript";
  role: "user" | "assistant";
  text: string;
};
