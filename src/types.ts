export type ProviderVoice = {
  id: string;
  voice_id: string;
  voice_name: string;
  supported_languages?: string[];
};

export type ProviderOption = {
  id: string;
  provider_name: string;
  model_name: string;
  is_default?: boolean;
  default_voice?: string;
  voices?: ProviderVoice[];
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

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
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

export type CreateSessionBody = Partial<ProviderSelection> & {
  org_id: string;
  project_id: string;
  agent_id?: string;
  post_call_analysis_ids?: string[];
  channel?: "web" | "telephony";
  provider?: "twilio" | "plivo";
  record?: boolean;
};

export type SessionInfo = {
  session_id: string;
  org_id: string;
  project_id: string;
  channel: string;
  provider?: string | null;
  transport: string;
  status: string;
  room_name: string | null;
  ws_url?: string | null;
  token?: string | null;
  media_ws_url?: string | null;
  ws_ticket?: string | null;
  llm_id: string;
  stt_id: string;
  tts_id: string;
  created_at: string;
  ended_at: string | null;
};

export type UsageSummaryRow = {
  metric_type: string;
  provider_name: string;
  model_name: string;
  total_quantity: number;
};

export type SessionUsageMetric = {
  metric_type: string;
  provider_name: string;
  model_name: string;
  total_quantity: number;
};

export type SessionUsage = {
  session_id: string;
  created_at: string | null;
  status: string | null;
  metrics: SessionUsageMetric[];
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type Recording = {
  id: string;
  session_id: string;
  org_id: string;
  project_id: string;
  status: string;
  storage_path: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  created_at: string | null;
  ended_at: string | null;
};

export type PlaybackUrl = {
  url: string;
  expires_in: number;
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

export type AnalysisFieldType = "string" | "number" | "boolean" | "enum";

export type AnalysisField = {
  name: string;
  type: AnalysisFieldType;
  description: string;
  enum_values?: string[] | null;
};

export type PostCallAnalysis = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  prompt: string;
  eval_llm_id: string;
  fields: AnalysisField[];
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AgentAnalysis = PostCallAnalysis & { enabled: boolean };

export type Agent = {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  system_prompt: string;
  greeting: string | null;
  llm_id: string;
  stt_id: string;
  tts_id: string;
  tts_voice_id: string | null;
  config: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AgentVersion = {
  version: number;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  created_at: string;
};

export type TranscriptTurn = { role: string; text: string; ts?: string | null };

export type TranscriptInfo = {
  session_id: string;
  transcript: string;
  turns: TranscriptTurn[];
  created_at: string;
};

export type AnalysisResult = {
  post_call_analysis_id: string;
  name: string;
  status: "pending" | "skipped" | "completed" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};
