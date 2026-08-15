export type CatalogVoice = {
  id: string;
  provider_id: string;
  voice_id: string;
  voice_name: string;
  supported_languages: string[];
  user_id: string | null;
  source: "catalog" | "cloned";
  gender?: string | null;
  preview_url?: string | null;
};

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
  supported_languages?: string[];
  voices?: ProviderVoice[];
};

export type CallLanguage = {
  code: string;
  name: string;
  native_name: string;
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
  languages?: CallLanguage[];
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
  country: string | null;
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
  provider?: "twilio" | "plivo" | "exotel";
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
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  reasoning_tokens: number | null;
  input_audio_tokens: number | null;
  output_audio_tokens: number | null;
  cache_read_input_audio_tokens: number | null;
  total_tokens: number | null;
};

export type SessionUsage = {
  session_id: string;
  created_at: string | null;
  status: string | null;
  transport: string | null;
  duration_seconds: number | null;
  metrics: SessionUsageMetric[];
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type UsageDailyRow = {
  day: string;
  metric_type: string;
  provider_name: string;
  model_name: string;
  transport: string;
  total_quantity: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  reasoning_tokens: number;
  input_audio_tokens: number;
  output_audio_tokens: number;
  cache_read_input_audio_tokens: number;
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
  error_message?: string | null;
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
  /** false while STT is still streaming partials; true (or omitted) when committed */
  final?: boolean;
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

/** Feature knobs persisted on `agents.config` (jsonb). */
export type NoiseCancellation = "off" | "low" | "medium" | "high";
export type BackgroundNoiseSource = "preset" | "asset";
export type EndOfCallWarningMode = "simple" | "session_aware";

export type AgentLlmConfig = {
  temperature: number;
  max_tokens: number;
  language: string;
  allowed_languages?: string[];
  multilingual_enabled?: boolean;
  auto_detect_language?: boolean;
  output_numbers_indic?: boolean;
};

export type AgentSessionConfig = {
  max_duration_seconds: number;
  allow_interruptions: boolean;
  record_calls: boolean;
};

export type AgentTurnConfig = {
  vad_stop_secs: number;
};

export type BackgroundNoiseConfig = {
  enabled: boolean;
  source: BackgroundNoiseSource;
  id: string;
  volume: number;
};

export type AgentAudioConfig = {
  noise_cancellation: NoiseCancellation;
  background_noise: BackgroundNoiseConfig;
};

export type EndOfCallWarningConfig = {
  enabled: boolean;
  warn_before_seconds: number;
  mode: EndOfCallWarningMode;
  simple_message: string;
  session_aware_template: string;
};

export type SilenceBreakerConfig = {
  enabled: boolean;
  idle_seconds: number;
};

export type VoicemailDetectionConfig = {
  enabled: boolean;
  message: string;
  response_delay: number;
};

export type AutoCutConfig = {
  enabled: boolean;
};

export type TransferRingStrategy = "simultaneous" | "sequential";

export type TransferNumber = { number: string; label: string };

export type TransferDestination = {
  id: string;
  name: string;
  description: string;
  ring_strategy: TransferRingStrategy;
  ring_timeout_seconds: number;
  numbers: TransferNumber[];
  transfer_message: string;
  no_answer_message: string;
};

export type CallTransferConfig = {
  enabled: boolean;
  destinations: TransferDestination[];
};

export type PromptVariable = {
  key: string;
  description: string;
  example: string;
};

export type AgentConfig = {
  llm: AgentLlmConfig;
  session: AgentSessionConfig;
  turn: AgentTurnConfig;
  audio: AgentAudioConfig;
  end_of_call_warning: EndOfCallWarningConfig;
  silence_breaker: SilenceBreakerConfig;
  voicemail_detection: VoicemailDetectionConfig;
  auto_cut: AutoCutConfig;
  call_transfer: CallTransferConfig;
  variables: PromptVariable[];
};

export type AmbientPreset = {
  id: string;
  name: string;
  description: string;
  kind: string;
  is_preset: true;
};

export type AudioAsset = {
  id: string;
  org_id: string;
  project_id: string;
  kind: string;
  name: string;
  storage_bucket: string;
  storage_path: string;
  sample_rate: number | null;
  duration_ms: number | null;
  content_type: string;
  size_bytes: number | null;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AudioAssetList = {
  presets: AmbientPreset[];
  items: AudioAsset[];
  total: number;
  limit: number;
  offset: number;
};

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
  config: AgentConfig;
  flow_definition: FlowDefinition;
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

export type Member = {
  user_id: string;
  email: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  project_ids: string[];
};

export type Membership = {
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "api_key";
  project_ids: string[];
};

export type ApiKey = {
  id: string;
  project_id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

export type CreatedApiKey = ApiKey & { api_key: string };

export type CatalogTool = {
  id: string;
  org_id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  required: string[];
  http_url: string | null;
  http_method: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AgentTool = CatalogTool & { enabled: boolean };

export type FlowDefinition = {
  initial_node: string;
  nodes: Record<string, FlowNode>;
};

export type FlowNodeFunction =
  | { kind: "transition"; name: string; description: string; next_node: string }
  | { kind: "tool"; tool_id: string };

export type FlowNode = {
  name: string;
  role_message?: string;
  task_messages: { role: string; content: string }[];
  functions?: FlowNodeFunction[];
  respond_immediately?: boolean;
  position?: { x: number; y: number };
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

export type TelephonyProviderName = "twilio" | "plivo" | "exotel";

export type BatchStatus = "draft" | "running" | "paused" | "completed" | "cancelled";
export type ContactStatus = "pending" | "in_progress" | "completed" | "failed" | "exhausted" | "cancelled";

export type RetryPolicy = {
  max_retries: number;
  retry_delay_seconds: number;
  retryable_outcomes: string[];
};

export type TelephonyAccount = {
  id: string;
  org_id: string;
  provider: TelephonyProviderName;
  label: string;
  account_sid: string;
  from_number: string;
  exotel_subdomain: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type TelephonyAccountBody = {
  provider: TelephonyProviderName;
  label?: string;
  account_sid: string;
  api_key: string;
  from_number: string;
  exotel_subdomain?: string | null;
  is_default?: boolean;
};

export type Batch = {
  id: string;
  org_id: string;
  project_id: string;
  agent_id: string;
  telephony_account_id: string;
  name: string;
  status: BatchStatus;
  max_concurrent_calls: number;
  retry_policy: RetryPolicy;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type BatchCreateBody = {
  org_id: string;
  project_id: string;
  agent_id: string;
  telephony_account_id: string;
  name: string;
  max_concurrent_calls?: number;
  retry_policy?: RetryPolicy;
};

export type BatchContact = {
  id: string;
  batch_id: string;
  phone_number: string;
  variables: Record<string, unknown>;
  status: ContactStatus;
  attempt_count: number;
  created_at: string;
  updated_at: string;
};

export type BatchStats = {
  batch_id: string;
  contacts_by_status: Record<string, number>;
  attempts_by_status: Record<string, number>;
};

export type RateLimitScope = "workspace" | "telephony" | "llm" | "tts" | "stt";

export type RateLimitConfig = {
  id: string;
  org_id: string | null;
  scope: RateLimitScope;
  provider_or_model_key: string;
  max_concurrent: number;
  requests_per_second: number;
  burst: number;
  created_at: string;
  updated_at: string;
};
