import type { AsciiIconKind, AsciiIconTone } from "@/components/voice-agents/ascii-icons";

export type DeployApiSlug =
  | "instant-outbound"
  | "batch-outbound"
  | "recipient-lists"
  | "inbound-deployments"
  | "data-fetch"
  | "billing"
  | "agents-sdk"
  | "dnd-lists"
  | "agent-management"
  | "call-transfer"
  | "voice-cloning"
  | "tool-integrations";

export type DeployRecipeSlug =
  | "moengage"
  | "outbound-callback"
  | "embed-website";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  summary: string;
}

export interface DeployApiCard {
  slug: DeployApiSlug;
  title: string;
  description: string;
  kind: AsciiIconKind;
  tone: AsciiIconTone;
  headline: string;
  about: string;
  /** Mintlify-style endpoint reference table — method chip + path + one-line summary. */
  endpoints: ApiEndpoint[];
  curlTabs: { id: string; label: string; code: string }[];
}

/** Base URL shown in generated snippets — never a real secret, just the API host. */
export const API_BASE_URL = "https://x.kupe.in";

export interface DeployRecipe {
  slug: DeployRecipeSlug;
  title: string;
  summary: string;
  body: string[];
  steps: { title: string; body: string; callout?: string }[];
}

export const DEPLOY_API_CARDS: DeployApiCard[] = [
  {
    slug: "instant-outbound",
    title: "Instant outbound",
    description: "Place a single outbound call with one API request.",
    kind: "outbound",
    tone: "sky",
    headline: "Place one outbound call with a single request.",
    about:
      "A call is a session — POST /v1/sessions with channel=\"telephony\" and a provider (twilio, plivo, or exotel) starts one outbound call immediately through your connected telephony account. The response includes the live session id you use to poll status, fetch the transcript, or pull the recording once the call ends.",
    endpoints: [
      { method: "POST", path: "/v1/sessions", summary: "Start one outbound (or web) call for an agent." },
      { method: "GET", path: "/v1/sessions/{session_id}", summary: "Get a session's current status." },
      { method: "POST", path: "/v1/sessions/{session_id}/end", summary: "End a session in progress." },
      { method: "GET", path: "/v1/orgs/{org_id}/sessions", summary: "List sessions for an org, paginated." },
    ],
    curlTabs: [
      {
        id: "create-call",
        label: "create-call",
        code: `curl -X POST ${API_BASE_URL}/v1/sessions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "org_id": "<org_id>",
    "project_id": "<project_id>",
    "agent_id": "<agent_id>",
    "channel": "telephony",
    "provider": "plivo"
  }'`,
      },
      {
        id: "get-call",
        label: "get-call",
        code: `curl ${API_BASE_URL}/v1/sessions/<session_id> \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "batch-outbound",
    title: "Batch outbound calling",
    description: "Run outbound calling campaigns at scale.",
    kind: "batch",
    tone: "amber",
    headline: "Point an agent at a list. The platform does the rest.",
    about:
      "A batch ties an agent and a telephony account to a list of contacts, with a concurrency cap and retry policy. Prefer named recipient lists (see Recipient lists) for reusable cohorts — create a batch, attach a list with contacts:from-list (or add contacts via bulk JSON / CSV), then start it. The platform dials up to max_concurrent_calls at a time, retrying retryable outcomes per your retry_policy. Pause/resume/cancel never interrupt a call already in progress.",
    endpoints: [
      { method: "POST", path: "/v1/batches", summary: "Create a batch (draft) for an agent + telephony account." },
      { method: "GET", path: "/v1/orgs/{org_id}/projects/{project_id}/batches", summary: "List batches, paginated." },
      { method: "GET", path: "/v1/batches/{batch_id}", summary: "Get a batch's status and config." },
      { method: "GET", path: "/v1/batches/{batch_id}/stats", summary: "Get dial/answer/completion counts for a batch." },
      { method: "PATCH", path: "/v1/batches/{batch_id}/schedule", summary: "Set recurrence / dial window / per-period limit." },
      { method: "POST", path: "/v1/batches/{batch_id}/contacts:from-list", summary: "Copy a named recipient list into this draft batch." },
      { method: "POST", path: "/v1/batches/{batch_id}/contacts:bulk", summary: "Add contacts from a JSON array." },
      { method: "POST", path: "/v1/batches/{batch_id}/contacts", summary: "Add contacts from an uploaded CSV (phone column)." },
      { method: "GET", path: "/v1/batches/{batch_id}/contacts", summary: "List contacts — use ?cursor= for keyset pagination at scale." },
      { method: "POST", path: "/v1/batches/{batch_id}/start", summary: "Start dialing a draft batch." },
      { method: "POST", path: "/v1/batches/{batch_id}/pause", summary: "Pause — stop dequeuing new contacts." },
      { method: "POST", path: "/v1/batches/{batch_id}/resume", summary: "Resume a paused batch." },
      { method: "POST", path: "/v1/batches/{batch_id}/cancel", summary: "Cancel a batch permanently." },
    ],
    curlTabs: [
      {
        id: "create-batch",
        label: "create-batch",
        code: `curl -X POST ${API_BASE_URL}/v1/batches \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "org_id": "<org_id>",
    "project_id": "<project_id>",
    "agent_id": "<agent_id>",
    "telephony_account_id": "<telephony_account_id>",
    "name": "Q3 renewal dials",
    "max_concurrent_calls": 5,
    "retry_policy": { "max_retries": 1, "retry_delay_seconds": 90, "retryable_outcomes": ["no_answer", "busy"] }
  }'`,
      },
      {
        id: "upload-contacts",
        label: "upload-contacts",
        code: `curl -X POST ${API_BASE_URL}/v1/batches/<batch_id>/contacts \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -F "file=@contacts.csv"`,
      },
      {
        id: "start-pause",
        label: "start / pause",
        code: `curl -X POST ${API_BASE_URL}/v1/batches/<batch_id>/start \\
  -H "Authorization: Bearer $KUPE_API_KEY"

curl -X POST ${API_BASE_URL}/v1/batches/<batch_id>/pause \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "recipient-lists",
    title: "Recipient lists",
    description: "Create named people batches, reuse them across campaigns, paginate at scale.",
    kind: "batch",
    tone: "coral",
    headline: "Name a list of people once. Reuse it on every campaign.",
    about:
      "Recipient lists are reusable cohorts — name them, upload CSV (phone column required; extras become variables), or add members in bulk. Campaigns stay separate: attach a list to a draft batch with contacts:from-list and the platform copies members into campaign contacts in SQL (safe for millions). Member and contact reads use keyset cursors so deep pages stay smooth. Manage lists from the API or the Outbound campaign wizard.",
    endpoints: [
      { method: "POST", path: "/v1/recipient-lists", summary: "Create a named recipient list in a workspace." },
      { method: "GET", path: "/v1/orgs/{org_id}/projects/{project_id}/recipient-lists", summary: "List saved recipient lists, paginated." },
      { method: "GET", path: "/v1/recipient-lists/{list_id}", summary: "Get a list and its member_count." },
      { method: "PATCH", path: "/v1/recipient-lists/{list_id}", summary: "Rename or update description." },
      { method: "DELETE", path: "/v1/recipient-lists/{list_id}", summary: "Delete a list and its members." },
      { method: "POST", path: "/v1/recipient-lists/{list_id}/members:bulk", summary: "Append members from JSON (returns inserted count only)." },
      { method: "POST", path: "/v1/recipient-lists/{list_id}/members", summary: "Append members from CSV multipart (phone column)." },
      { method: "GET", path: "/v1/recipient-lists/{list_id}/members", summary: "Keyset-paginated members (?limit=&cursor=)." },
      { method: "PATCH", path: "/v1/recipient-lists/{list_id}/members/{member_id}", summary: "Update one member's phone or variables." },
      { method: "DELETE", path: "/v1/recipient-lists/{list_id}/members/{member_id}", summary: "Remove one member." },
      { method: "POST", path: "/v1/batches/{batch_id}/contacts:from-list", summary: "Copy an entire list into a draft campaign." },
      { method: "GET", path: "/v1/batches/{batch_id}/contacts", summary: "Campaign people — pass cursor= for keyset pages." },
    ],
    curlTabs: [
      {
        id: "create-list",
        label: "create-list",
        code: `curl -X POST ${API_BASE_URL}/v1/recipient-lists \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "org_id": "<org_id>",
    "project_id": "<project_id>",
    "name": "Q3 renewals — West",
    "description": "Warm leads from CRM export"
  }'`,
      },
      {
        id: "upload-members",
        label: "upload-csv",
        code: `# CSV must include a phone column (not phone_number)
curl -X POST ${API_BASE_URL}/v1/recipient-lists/<list_id>/members \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -F "file=@contacts.csv"`,
      },
      {
        id: "attach-campaign",
        label: "attach-to-campaign",
        code: `curl -X POST ${API_BASE_URL}/v1/batches/<batch_id>/contacts:from-list \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{ "recipient_list_id": "<list_id>" }'

# Page campaign people with a keyset cursor (first page: cursor=)
curl "${API_BASE_URL}/v1/batches/<batch_id>/contacts?limit=50&cursor=" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "inbound-deployments",
    title: "Inbound deployments",
    description: "Deploy an agent on a number to answer inbound calls.",
    kind: "incoming",
    tone: "emerald",
    headline: "Answer every inbound call with your agent.",
    about:
      "Bind an agent to a number and set when it answers. Calls outside those hours are not connected. Availability is stored on the inbound deployment and evaluated in the number’s timezone. For Plivo, set the number’s Answer URL to https://x.kupe.in/v1/telephony/plivo/inbound and Hangup URL to https://x.kupe.in/v1/telephony/plivo/inbound/status (POST). Kupe-managed numbers get these URLs attached on purchase.",
    endpoints: [
      { method: "POST", path: "/v1/inbound", summary: "Create an inbound deployment (agent + number + hours)." },
      { method: "GET", path: "/v1/orgs/{org_id}/projects/{project_id}/inbound", summary: "List inbound deployments." },
      { method: "GET", path: "/v1/inbound/{deployment_id}", summary: "Get one inbound deployment." },
      { method: "PATCH", path: "/v1/inbound/{deployment_id}", summary: "Update name, status, agent, or availability." },
      { method: "DELETE", path: "/v1/inbound/{deployment_id}", summary: "Remove an inbound deployment." },
      { method: "POST", path: "/v1/telephony/plivo/inbound", summary: "Plivo inbound Answer URL (voice_url) — set this on the number." },
      { method: "POST", path: "/v1/telephony/plivo/inbound/status", summary: "Plivo inbound Hangup URL (hangup_url)." },
      { method: "POST", path: "/v1/orgs/{org_id}/telephony-accounts", summary: "Connect a Twilio/Plivo/Exotel account." },
      { method: "GET", path: "/v1/orgs/{org_id}/telephony-accounts", summary: "List connected telephony accounts." },
    ],
    curlTabs: [
      {
        id: "create-inbound",
        label: "create-inbound",
        code: `curl -X POST ${API_BASE_URL}/v1/inbound \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "org_id": "<org_id>",
    "project_id": "<project_id>",
    "agent_id": "<agent_id>",
    "telephony_account_id": "<telephony_account_id>",
    "name": "Support inbound",
    "availability": {
      "always": false,
      "timezone": "Asia/Kolkata",
      "days_of_week": [1, 2, 3, 4, 5],
      "start": "09:00",
      "end": "18:00",
      "after_hours_message": "We are closed. Please call back during business hours."
    }
  }'`,
      },
      {
        id: "connect-account",
        label: "connect-account",
        code: `curl -X POST ${API_BASE_URL}/v1/orgs/<org_id>/telephony-accounts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "provider": "plivo",
    "label": "Support line",
    "account_sid": "<provider_account_sid>",
    "api_key": "<provider_auth_token>",
    "from_number": "+9111XXXXXXXX"
  }'`,
      },
    ],
  },
  {
    slug: "call-transfer",
    title: "Call transfer",
    description: "Let a live agent hand off to a human, with an ordered fallback list.",
    kind: "transfer",
    tone: "coral",
    headline: "Hand off to a human — with a fallback dial order if the first line doesn't pick up.",
    about:
      "Configure call_transfer on an agent's config with one or more named destinations. Each destination holds an ordered list of numbers — the agent tries them in sequence (ring_strategy: \"sequential\") for ring_timeout_seconds each, so the second number acts as a fallback if the first doesn't answer, and so on down the list. If every number in the destination is exhausted, no_answer_message plays and the call ends gracefully instead of hanging up abruptly. During a live call the agent's transfer_call tool triggers the same flow server-side via the internal transfer endpoint — you don't call that endpoint directly, you just configure destinations on the agent.",
    endpoints: [
      { method: "PATCH", path: "/v1/agents/{agent_id}", summary: "Set config.call_transfer.destinations (numbers, ring order, fallback message)." },
      { method: "GET", path: "/v1/agents/{agent_id}", summary: "Read an agent's current transfer configuration." },
    ],
    curlTabs: [
      {
        id: "configure-transfer",
        label: "configure-transfer",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "call_transfer": {
        "enabled": true,
        "destinations": [
          {
            "id": "sales",
            "name": "Sales team",
            "ring_strategy": "sequential",
            "ring_timeout_seconds": 20,
            "numbers": [
              { "number": "+9198XXXXXXX1", "label": "Primary" },
              { "number": "+9198XXXXXXX2", "label": "Fallback" }
            ],
            "transfer_message": "One moment, I am transferring you now.",
            "no_answer_message": "Sorry, no one is available right now. Goodbye."
          }
        ]
      }
    }
  }'`,
      },
    ],
  },
  {
    slug: "data-fetch",
    title: "Data fetch",
    description: "Fetch call outcomes, recordings, and transcripts.",
    kind: "chart",
    tone: "rose",
    headline: "Pull outcomes and media after every call.",
    about:
      "Every session has a transcript, a recording (if enabled), and usage/cost line items. Fetch them by session id, or list usage across an org for a date range.",
    endpoints: [
      { method: "GET", path: "/v1/sessions/{session_id}/transcript", summary: "Get the full call transcript." },
      { method: "GET", path: "/v1/sessions/{session_id}/recording", summary: "Get recording metadata for a session." },
      { method: "GET", path: "/v1/recordings/{recording_id}/playback-url", summary: "Get a short-lived playback URL." },
      { method: "GET", path: "/v1/orgs/{org_id}/recordings", summary: "List recordings for an org." },
      { method: "GET", path: "/v1/sessions/{session_id}/analysis", summary: "Get post-call analysis results." },
      { method: "GET", path: "/v1/orgs/{org_id}/usage", summary: "Usage/cost summary for an org." },
      { method: "GET", path: "/v1/orgs/{org_id}/usage/daily", summary: "Daily usage rollups." },
      { method: "GET", path: "/v1/orgs/{org_id}/usage/sessions", summary: "Call sessions with clubbed cost. Pass currency=USD|INR (default USD)." },
      { method: "GET", path: "/v1/sessions/{session_id}/usage", summary: "Per-call metric breakdown, including TTS used on the call and a Kupe infra_cost markup line." },
      { method: "GET", path: "/v1/orgs/{org_id}/usage/standalone", summary: "Non-call usage such as Voice Library TTS." },
    ],
    curlTabs: [
      {
        id: "get-transcript",
        label: "get-transcript",
        code: `curl ${API_BASE_URL}/v1/sessions/<session_id>/transcript \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "usage",
        label: "usage",
        code: `curl "${API_BASE_URL}/v1/orgs/<org_id>/usage/sessions?start_date=2026-07-26&end_date=2026-08-01&currency=USD" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "billing",
    title: "Billing",
    description: "Wallet balance, credits, and invoices for an organization.",
    kind: "pricing",
    tone: "emerald",
    headline: "Read wallet and invoices in USD or INR.",
    about:
      "Billing amounts are converted at the latest exchange rate for the currency you request. APIs default to USD; pass currency=INR to match the dashboard. Call-session costs stay grouped on /usage/sessions — click through /v1/sessions/{id}/usage for the per-metric breakdown. Voice Library TTS and similar extras are listed separately on /usage/standalone.",
    endpoints: [
      { method: "GET", path: "/v1/orgs/{org_id}/billing/wallet", summary: "Wallet balance and credits. Default currency USD." },
      { method: "GET", path: "/v1/billing/plans", summary: "Plan catalog in the requested currency. Default USD." },
      { method: "GET", path: "/v1/orgs/{org_id}/billing/invoices", summary: "List invoices, paginated." },
      { method: "GET", path: "/v1/orgs/{org_id}/usage/cost-summary", summary: "Period usage total in the requested currency." },
    ],
    curlTabs: [
      {
        id: "wallet",
        label: "wallet",
        code: `curl "${API_BASE_URL}/v1/orgs/<org_id>/billing/wallet?currency=USD" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "invoices",
        label: "invoices",
        code: `curl "${API_BASE_URL}/v1/orgs/<org_id>/billing/invoices?currency=USD" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "agent-management",
    title: "Agent management",
    description: "Create, version, update, and roll back agents from your own stack.",
    kind: "robot",
    tone: "violet",
    headline: "Manage agents as code — every save is a new version.",
    about:
      "Agents are versioned: every PATCH creates a new version and you can list or revert to any prior one. An agent's config carries its provider selection (llm_id, stt_id, tts_id, tts_voice_id), system prompt, tools, call-transfer destinations, and call-behavior knobs such as thinking_sounds — everything the voice-agents UI edits is available here too. Set config.thinking_sounds.enabled to play a short language-specific filler (hmm / umm, or the Indic equivalent) through the agent's TTS the instant the caller finishes speaking, before the real reply audio starts.",
    endpoints: [
      { method: "POST", path: "/v1/orgs/{org_id}/projects/{project_id}/agents", summary: "Create an agent." },
      { method: "GET", path: "/v1/orgs/{org_id}/projects/{project_id}/agents", summary: "List agents, paginated." },
      { method: "GET", path: "/v1/agents/{agent_id}", summary: "Get an agent's current config." },
      { method: "PATCH", path: "/v1/agents/{agent_id}", summary: "Update an agent — creates a new version. Pass config.thinking_sounds.enabled to toggle thinking sounds." },
      { method: "POST", path: "/v1/agents/{agent_id}/commit", summary: "Commit the current draft as a new version. Optional JSON body: { \"message\": \"what changed\" }." },
      { method: "GET", path: "/v1/agents/{agent_id}/versions", summary: "List committed versions. Each item includes version, message, created_at, and snapshot." },
      { method: "POST", path: "/v1/agents/{agent_id}/revert/{version}", summary: "Roll back to a prior version." },
      { method: "POST", path: "/v1/agents/{agent_id}/archive", summary: "Archive an agent." },
      { method: "GET", path: "/v1/agents/{agent_id}/tools", summary: "List tools attached to an agent." },
      { method: "POST", path: "/v1/agents/{agent_id}/tools", summary: "Attach a tool to an agent." },
      { method: "DELETE", path: "/v1/agents/{agent_id}/tools/{tool_id}", summary: "Detach a tool." },
    ],
    curlTabs: [
      {
        id: "create-agent",
        label: "create-agent",
        code: `curl -X POST ${API_BASE_URL}/v1/orgs/<org_id>/projects/<project_id>/agents \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "name": "Support line",
    "system_prompt": "You are a helpful support agent for Acme.",
    "llm_id": "<llm_provider_id>",
    "stt_id": "<stt_provider_id>",
    "tts_id": "<tts_provider_id>",
    "tts_voice_id": "<voice_id>"
  }'`,
      },
      {
        id: "update-agent",
        label: "update-agent",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{ "greeting": "Hi, thanks for calling Acme — how can I help?" }'`,
      },
      {
        id: "thinking-sounds",
        label: "thinking-sounds",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "thinking_sounds": { "enabled": true }
    }
  }'`,
      },
    ],
  },
  {
    slug: "voice-cloning",
    title: "Voice cloning",
    description: "Clone a voice from a short sample and use it on any agent.",
    kind: "upload",
    tone: "amber",
    headline: "Clone a voice once, reuse it on any agent — public or kept private to you.",
    about:
      "Upload a clean audio sample to clone a voice. The cloned voice is stored in your voice library with source=\"cloned\" and behaves exactly like a catalog voice everywhere an agent picks a tts_voice_id — you can make it public (visible to your whole org's voice library) or keep it private to your account. All Kupe voices — catalog and cloned — are served under a single provider so your integration code never needs to change providers.",
    endpoints: [
      { method: "GET", path: "/v1/providers", summary: "List LLM / STT / TTS providers and their default voices." },
      { method: "GET", path: "/v1/voices", summary: "List voices for a TTS provider — pass provider=kupe (name) or provider_id (UUID)." },
      { method: "POST", path: "/v1/voices/clone", summary: "Clone a voice from an uploaded audio sample." },
      { method: "PATCH", path: "/v1/voices/{voice_id}", summary: "Rename a cloned voice or change public/private." },
      { method: "DELETE", path: "/v1/voices/{voice_id}", summary: "Delete a cloned voice you own." },
    ],
    curlTabs: [
      {
        id: "clone-voice",
        label: "clone-voice",
        code: `curl -X POST ${API_BASE_URL}/v1/voices/clone \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -F "name=Priya" \\
  -F "is_public=false" \\
  -F "sample=@priya-sample.wav"`,
      },
      {
        id: "list-voices",
        label: "list-voices",
        code: `curl "${API_BASE_URL}/v1/voices?provider=kupe" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "agents-sdk",
    title: "Agents SDK",
    description: "Build and deploy an agent on your own stack.",
    kind: "code",
    tone: "rose",
    headline: "Ship agents from your own codebase.",
    about:
      "Everything the Agents SDK does maps 1:1 onto Agent management + Call transfer + Voice cloning above — the SDK is a thin typed wrapper over those REST endpoints for teams that prefer defining agents in code and publishing on deploy.",
    endpoints: [
      { method: "POST", path: "/v1/orgs/{org_id}/projects/{project_id}/agents", summary: "Publish creates (or updates) an agent." },
    ],
    curlTabs: [
      {
        id: "publish",
        label: "publish",
        code: `npx @kupe/agents publish ./agent \\
  --api-key $KUPE_API_KEY`,
      },
    ],
  },
  {
    slug: "dnd-lists",
    title: "DND lists",
    description: "Manage do-not-disturb numbers for outbound campaigns.",
    kind: "forbidden",
    tone: "violet",
    headline: "Respect do-not-disturb preferences at dial time.",
    about:
      "DND lists are managed per batch today: mark contacts you never want dialed as \"do not contact\" and they're skipped when a batch dequeues, without deleting them from your contact records.",
    endpoints: [
      { method: "GET", path: "/v1/batches/{batch_id}/contacts", summary: "List a batch's contacts and their status." },
      { method: "POST", path: "/v1/batches/{batch_id}/contacts:bulk", summary: "Re-upload a contact list with opted-out numbers removed." },
    ],
    curlTabs: [
      {
        id: "list-contacts",
        label: "list-contacts",
        code: `curl "${API_BASE_URL}/v1/batches/<batch_id>/contacts?status=queued" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
    ],
  },
  {
    slug: "tool-integrations",
    title: "Tool integrations",
    description: "Custom webhook tools, your own MCP, and 1000+ Composio apps — all callable mid-call.",
    kind: "code",
    tone: "sky",
    headline: "Give your agent real actions — a webhook, your MCP server, or any Composio app.",
    about:
      "Every tool your agent can call during a conversation is a row in the same org-scoped catalog, attached to an agent the same way regardless of where it executes: a custom HTTP webhook you own, or a Composio-backed action (Gmail, Slack, Calendar, CRMs, and 1000+ more) authorized once per org. Both execute server-side, in kupe-agents, mid-call — never client-side, so they work identically on web and phone calls. Everything here also works from the Integrations tab in the dashboard; use the API when you want tools provisioned as part of your own deploy, not clicked through by hand.",
    endpoints: [
      { method: "POST", path: "/v1/orgs/{org_id}/tools", summary: "Create a custom webhook tool (name, JSON-schema parameters, http_url/method/headers)." },
      { method: "GET", path: "/v1/orgs/{org_id}/tools", summary: "List your org's tool catalog (webhook + Composio)." },
      { method: "PATCH", path: "/v1/tools/{tool_id}", summary: "Update a tool's schema, URL, or headers." },
      { method: "POST", path: "/v1/agents/{agent_id}/tools", summary: "Attach any tool (webhook or Composio) to an agent." },
      { method: "GET", path: "/v1/orgs/{org_id}/composio/toolkits", summary: "Browse connectable apps (logos, categories, connection status)." },
      { method: "POST", path: "/v1/orgs/{org_id}/composio/connections", summary: "Start connecting an app — returns an OAuth redirect URL when one's needed." },
      { method: "GET", path: "/v1/orgs/{org_id}/composio/toolkits/{toolkit_slug}/tools", summary: "List the actions available once an app is connected." },
      { method: "POST", path: "/v1/orgs/{org_id}/composio/tools", summary: "Add a specific Composio action to your tool catalog." },
      { method: "GET", path: "/v1/orgs/{org_id}/agents/{agent_id}/tool-call-stats", summary: "Per-tool call count, success rate, and latency for an agent." },
    ],
    curlTabs: [
      {
        id: "create-webhook-tool",
        label: "webhook-tool",
        code: `curl -X POST ${API_BASE_URL}/v1/orgs/<org_id>/tools \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "name": "check_availability",
    "description": "Look up open appointment slots",
    "parameters": {"date": {"type": "string"}},
    "required": ["date"],
    "http_url": "https://api.yourcrm.com/slots",
    "http_method": "GET"
  }'

# attach it to an agent
curl -X POST ${API_BASE_URL}/v1/agents/<agent_id>/tools \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{"tool_id": "<tool_id>", "enabled": true}'`,
      },
      {
        id: "connect-composio-app",
        label: "composio-app",
        code: `# 1. browse connectable apps
curl "${API_BASE_URL}/v1/orgs/<org_id>/composio/toolkits?category=email" \\
  -H "Authorization: Bearer $KUPE_API_KEY"

# 2. connect one (open redirect_url for OAuth apps)
curl -X POST ${API_BASE_URL}/v1/orgs/<org_id>/composio/connections \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{"toolkit_slug": "gmail", "callback_url": "https://yourapp.com/callback"}'

# 3. add a specific action once connected
curl -X POST ${API_BASE_URL}/v1/orgs/<org_id>/composio/tools \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{"toolkit_slug": "gmail", "tool_slug": "GMAIL_SEND_EMAIL", "connection_id": "<connection_id>"}'`,
      },
    ],
  },
];

export const DEPLOY_RECIPES: DeployRecipe[] = [
  {
    slug: "moengage",
    title: "Trigger Kupe calls from MoEngage campaigns or Flows",
    summary:
      "Voice agents that speak, listen, and complete tasks — triggered from MoEngage.",
    body: [
      "Kupe Voice Agents can speak naturally, understand callers, and complete booking or support tasks over the phone.",
      "Use the MoEngage App Marketplace connector to fire outbound calls from campaigns or Flows without writing custom glue code.",
    ],
    steps: [
      {
        title: "Create a Voice Agents API key",
        body: "Generate an API key in Deploy with code and treat it like a secret — never commit it to source control.",
        callout:
          "The key is displayed once at generation time, copy it immediately and store it in your secrets manager.",
      },
      {
        title: "Install the Kupe connector in MoEngage",
        body: "Open App Marketplace, search for Kupe Voice Agents, and paste your API key into the connector settings.",
      },
      {
        title: "Map campaign attributes to agent variables",
        body: "Pass user attributes such as name, phone, and appointment time into the agent variable schema.",
      },
    ],
  },
  {
    slug: "outbound-callback",
    title: "Outbound with inbound callback",
    summary: "Start outbound, then hand off to an inbound number for callbacks.",
    body: [
      "Some flows need a callback path after the first outbound attempt fails or the user asks to be called later.",
    ],
    steps: [
      {
        title: "Create outbound + inbound pair",
        body: "Deploy an inbound number and reference it from the outbound agent prompt as the callback line.",
      },
    ],
  },
  {
    slug: "embed-website",
    title: "Embed an agent on your website",
    summary: "Drop a web voice widget that uses the same agent configuration.",
    body: [
      "Embed the Kupe web SDK snippet and point it at a published agent version for browser-based voice.",
    ],
    steps: [
      {
        title: "Add the embed snippet",
        body: "Paste the generated script tag before </body> and set your public agent ID.",
      },
    ],
  },
];

export function getDeployApi(slug: string) {
  return DEPLOY_API_CARDS.find((c) => c.slug === slug) ?? null;
}

export function getDeployRecipe(slug: string) {
  return DEPLOY_RECIPES.find((r) => r.slug === slug) ?? null;
}
