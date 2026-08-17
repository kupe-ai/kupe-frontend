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
  /** Only meaningful for source="cloned" — visible org-wide vs. owner-only. */
  is_public?: boolean;
  /** Present when the library joins catalog rows onto each voice. */
  provider_name?: string;
  model_name?: string;
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
  capabilities?: { speaking_speed?: boolean; pitch?: boolean };
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
  started_at?: string | null;
  ended_at: string | null;
  user_identifier?: string | null;
  ended_by?: string | null;
  failure_reason?: string | null;
  hangup_reason?: string | null;
  language?: string | null;
  message_count?: number;
  duration_seconds?: number | null;
  avg_agent_latency_ms?: number | null;
  avg_user_latency_ms?: number | null;
  attempt_number?: number;
  goal_status?: string | null;
  agent_id?: string | null;
};

export type UsageSummaryRow = {
  metric_type: string;
  provider_name: string;
  model_name: string;
  total_quantity: number;
  currency: string | null;
  cost_minor_units: number;
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
  cost?: number;
  currency?: string | null;
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
  cost?: number;
  currency?: string | null;
};

export type StandaloneUsageRow = {
  day: string;
  source: string;
  metric_type: string;
  provider_name: string;
  model_name: string;
  total_quantity: number;
  cost: number;
  currency: string | null;
};

export type Wallet = {
  org_id: string;
  currency: string;
  balance: number;
  credits: number;
  credited: number;
  consumed: number;
  unmetered: boolean;
  insufficient: boolean;
  fx_rate: number | null;
  fx_date: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  has_pdf: boolean;
};

export type BillingPlan = {
  code: "payg" | "business" | "scale" | "enterprise";
  display_name: string;
  voice_rate_rupees: number | null;
  telephony_rate_rupees: number | null;
  phone_rental_rupees_per_month: number | null;
  monthly_commitment_rupees: number | null;
  min_topup_rupees?: number | null;
  is_self_serve: boolean;
};

export type TopupOrder = {
  razorpay_order_id: string;
  key_id: string;
  amount_minor_units: number;
  currency: string;
  credit_minor_units: number;
};

export type TopupVerifyResult = {
  status: string;
  credit_minor_units: number;
};

export type SubscriptionAction = {
  razorpay_subscription_id?: string | null;
  key_id?: string | null;
  amount_minor_units?: number | null;
  currency?: string | null;
  status: string;
  plan_code: string;
};

export type BillingSubscription = {
  org_id: string;
  plan_code: string;
  status: string;
  overages_enabled: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  recommended_plan: string | null;
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
  currency: string | null;
  cost_minor_units: number;
  cost?: number;
};

export type CurrencyCostTotal = {
  currency: string;
  cost: number;
  audio_seconds: number;
};

export type UsageCostSummary = {
  currency?: string;
  cost?: number;
  totals: CurrencyCostTotal[];
  minutes_consumed: number;
  fx_rate?: number | null;
  fx_date?: string | null;
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
  switch_after_seconds?: number | null;
};

export type AgentTtsConfig = {
  speaking_speed: number;
  pitch: number;
};

export type AgentSessionConfig = {
  max_duration_seconds: number;
  allow_interruptions: boolean;
  record_calls: boolean;
};

export type AgentTurnConfig = {
  vad_stop_secs: number;
  eagerness?: number;
  volume_threshold_db?: number;
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

export type SilenceBreakerMessage = {
  text: string;
  after_seconds: number;
};

export type SilenceBreakerConfig = {
  enabled: boolean;
  idle_seconds: number;
  messages?: SilenceBreakerMessage[];
  hangup_after_unanswered?: boolean;
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
  tts?: AgentTtsConfig;
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

export type FeatureFlags = {
  distinct_id: string;
  org_id: string | null;
  flags: Record<string, boolean>;
};

export type MemberAccess = {
  user_id: string;
  email: string;
  role: string;
  restricted: boolean;
  flags: Record<string, boolean>;
};

export type OrgAccess = {
  org_id: string;
  restricted: boolean;
  flags: Record<string, boolean>;
  members: MemberAccess[];
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

export type ToolKind = "custom_webhook" | "composio" | "mcp";

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
  kind: ToolKind;
  composio_toolkit_slug: string | null;
  composio_tool_slug: string | null;
  composio_connection_id: string | null;
  mcp_tool_name: string | null;
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
  managed_by_kupe: boolean;
  country_iso: string | null;
  monthly_rent_minor_units: number | null;
  rent_currency: string;
  next_rent_charge_at: string | null;
};

export type PlivoCountry = "US" | "IN";

export type PlivoComplianceStatus = "draft" | "submitted" | "accepted" | "rejected" | "suspended" | "expired";

export type PlivoNumberSearchResult = {
  number: string;
  country_iso: string;
  number_type: string;
  monthly_rental_rate: string | null;
  setup_rate: string | null;
  voice_enabled: boolean;
  sms_enabled: boolean;
  requires_compliance: boolean;
};

export type PlivoNumberSearchOut = {
  numbers: PlivoNumberSearchResult[];
  compliance_status: PlivoComplianceStatus | null;
  monthly_rent_inr: number;
  purchase_price_inr: number;
};

export type PlivoPurchaseBody = {
  number: string;
  country_iso: PlivoCountry;
  compliance_application_id?: string | null;
};

export type PlivoComplianceRequirement = {
  name: string;
  label: string;
  input_type: string;
  required: boolean;
};

export type PlivoComplianceRequirementsOut = {
  end_user_type: string;
  document_requirements: PlivoComplianceRequirement[];
  raw: Record<string, unknown>;
};

export type PlivoComplianceEndUser = {
  business_name: string;
  salutation?: string;
  first_name: string;
  last_name: string;
  fiscal_identification_code: string;
  email: string;
  phone_number: string;
  address_line1: string;
  city: string;
  region: string;
  postal_code: string;
  country_iso?: string;
};

export type PlivoComplianceSubmitBody = {
  end_user: PlivoComplianceEndUser;
  registration_certificate_base64: string;
  registration_certificate_filename?: string;
  gst_certificate_base64: string;
  gst_certificate_filename?: string;
};

export type PlivoComplianceApplication = {
  id: string;
  org_id: string;
  compliance_id: string;
  country_iso: string;
  number_type: string;
  user_type: string;
  business_name: string;
  status: PlivoComplianceStatus;
  rejection_reason: string | null;
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

export type BatchScheduleRecurrence = "once" | "daily" | "weekly" | "monthly";

export type BatchSchedule = {
  recurrence: BatchScheduleRecurrence | null;
  start_at: string | null;
  days_of_week: number[];
  day_of_month: number | null;
  window_start: string | null;
  window_end: string | null;
  timezone: string;
  limit_per_period: number | null;
};

export const EMPTY_BATCH_SCHEDULE: BatchSchedule = {
  recurrence: null,
  start_at: null,
  days_of_week: [],
  day_of_month: null,
  window_start: null,
  window_end: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  limit_per_period: null,
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
  schedule: BatchSchedule;
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
  schedule?: BatchSchedule;
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

// ---------------------------------------------------------------------
// Composio app integrations
// ---------------------------------------------------------------------

export type ComposioToolkitCategory = { id: string; name: string };

export type ComposioToolkit = {
  slug: string;
  name: string;
  logo: string;
  description: string;
  categories: ComposioToolkitCategory[];
  no_auth: boolean;
  connected: boolean;
};

export type ComposioToolkitsPage = {
  items: ComposioToolkit[];
  next_cursor: string | null;
};

export type ComposioTool = {
  slug: string;
  name: string;
  description: string;
  input_parameters: Record<string, unknown>;
};

export type ComposioToolsPage = {
  items: ComposioTool[];
  next_cursor: string | null;
};

export type ComposioConnectionStatus = "initializing" | "active" | "failed" | "expired";

export type ComposioConnection = {
  id: string;
  org_id: string;
  toolkit_slug: string;
  toolkit_name: string;
  status: ComposioConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type ComposioConnectOut = {
  connection: ComposioConnection;
  redirect_url: string | null;
};

export type ToolCallEvent = {
  id: number;
  session_id: string;
  agent_id: string | null;
  tool_name: string;
  tool_kind: "custom_webhook" | "composio" | "system";
  latency_ms: number;
  ok: boolean;
  created_at: string;
};

export type ToolCallStatsRow = {
  tool_name: string;
  tool_kind: "custom_webhook" | "composio" | "system";
  call_count: number;
  success_count: number;
  avg_latency_ms: number;
};
