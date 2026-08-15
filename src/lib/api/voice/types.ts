export interface PageResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface VoiceAgent {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  name: string;
  email: string | null;
  avatar_seed: string;
  status: "draft" | "live" | "archived";
  first_message: string | null;
  system_prompt: string;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  tts_voice_id: string | null;
  stt_provider_id: string | null;
  temperature: number;
  languages: string[];
  knowledge_base_id: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface VoiceAgentTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  about: string;
  scenario: string;
  seed: string;
  languages: string[];
  tools: string[];
  variables: string[];
  system_prompt: string;
  first_message: string | null;
}

export interface VoiceCall {
  id: string;
  agent_id: string;
  direction: "web" | "inbound" | "outbound";
  channel: "web" | "pstn";
  status: string;
  connectivity: string | null;
  failure_reason: string | null;
  ended_by: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  language: string | null;
  message_count: number;
  avg_agent_latency_ms: number | null;
  avg_user_latency_ms: number | null;
  attempt_number: number;
  user_identifier: string | null;
  goal_status: string | null;
  variables: Record<string, unknown>;
  recording_url?: string | null;
}

export interface VoiceCallTranscriptTurn {
  role: "agent" | "user" | "system";
  text: string;
  ts_offset_ms: number;
  ordinal: number;
}

export interface VoiceKnowledgeBase {
  id: string;
  name: string;
  description: string;
  status: "ready" | "processing" | "failed";
  created_at: string;
  updated_at: string;
}

export interface VoiceKnowledgeFile {
  id: string;
  kb_id: string;
  name: string;
  size_bytes: number;
  status: "ready" | "processing" | "failed";
  chunk_count: number;
  created_at: string;
}

export interface VoiceApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  key?: string; // present only on create response (one-time reveal)
}
