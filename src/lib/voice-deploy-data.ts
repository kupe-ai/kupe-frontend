import type { AsciiIconKind, AsciiIconTone } from "@/components/voice-agents/ascii-icons";

export type DeployApiSlug =
  | "kupe-realtime-api"
  | "kupe-mcp"
  | "instant-outbound"
  | "batch-outbound"
  | "recipient-lists"
  | "inbound-deployments"
  | "data-fetch"
  | "databases"
  | "billing"
  | "agents-sdk"
  | "dnd-lists"
  | "agent-management"
  | "workspace-timezone"
  | "caller-memory"
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
  sections?: { title: string; body: string }[];
}

/** Base URL shown in generated snippets — never a real secret, just the API host. */
export const API_BASE_URL = "https://x.kupe.in";

/** Hosted MCP endpoint (HTTP until TLS is live on mcp.kupe.in). */
export const MCP_REMOTE_URL = "http://mcp.kupe.in/mcp";

function sdkPython(code: string): { id: string; label: string; code: string } {
  return { id: "python", label: "python", code };
}

function sdkTypescript(code: string): { id: string; label: string; code: string } {
  return { id: "typescript", label: "typescript", code };
}

export interface DeployRecipe {
  slug: DeployRecipeSlug;
  title: string;
  summary: string;
  body: string[];
  steps: { title: string; body: string; callout?: string }[];
}

export const DEPLOY_API_CARDS: DeployApiCard[] = [
  {
    slug: "kupe-realtime-api",
    title: "Kupe Realtime API",
    description: "Python and TypeScript SDK for browser and backend voice: k-STT, k-TTS, and Kupe LLM.",
    kind: "code",
    tone: "violet",
    headline: "Install the Kupe SDK. Mint a session and stream voice.",
    about:
      "Kupe Realtime is a voice WebSocket (model kupe-realtime). Use pip install kupe or npm install kupe-sdk to mint a session with realtime.sessions.create. Pass name or agent_id — a new name creates the agent with prompt, greeting, voice, and tools or mcp. Then connect and stream PCM16 at 24 kHz. The session always runs k-STT, k-TTS, and the Kupe LLM. Voices are addressed by sanitized name or voice id. Tools run server-side. This API is web-only and does not write telephony minutes.",
    endpoints: [
      { method: "POST", path: "/v1/realtime/sessions", summary: "Mint an ephemeral client secret. Pass name or agent_id; new names create the agent with prompt, greeting, voice, tools/mcp." },
      { method: "GET", path: "/agents/v1/realtime", summary: "WebSocket (upgrade) on the agents host. Query model=kupe-realtime." },
    ],
    curlTabs: [
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()  # KUPE_API_KEY
session = client.realtime.sessions.create(
    name="Priya",
    voice="priya",
    prompt="You collect overdue EMIs. Be warm and brief.",
    greeting="Hi, this is Priya from the bank.",
)
with client.realtime.connect(session) as rt:
    rt.send_text("Hi — remind them EMI is due tomorrow.")
    for event in rt:
        if event.type == "response.output_audio_transcript.done":
            print(event.transcript)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe(); // KUPE_API_KEY
const session = await kupe.realtime.sessions.create({
  name: "Priya",
  voice: "priya",
  prompt: "You collect overdue EMIs. Be warm and brief.",
  greeting: "Hi, this is Priya from the bank.",
});
const rt = await kupe.realtime.connect(session);
rt.sendText("Hi — remind them EMI is due tomorrow.");
for await (const event of rt) {
  if (event.type === "response.output_audio_transcript.done") {
    console.log(event.transcript);
  }
}
`),
      {
        id: "mint-session",
        label: "curl",
        code: `curl -X POST ${API_BASE_URL}/v1/realtime/sessions \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Priya",
    "voice": "priya",
    "prompt": "You collect overdue EMIs. Be warm and brief.",
    "greeting": "Hi, this is Priya from the bank."
  }'`,
      },
    ],
    sections: [
      {
        title: "Connect",
        body: "wss://x.kupe.in/agents/v1/realtime?model=kupe-realtime with Authorization: Bearer sk-kupe-... (server) or the ephemeral client_secret (browser). POST /v1/realtime/sessions takes name or agent_id. If name is new, the agent is created with prompt, greeting, voice, and tools or mcp. Copy the id from the agent editor when you already have one.",
      },
      {
        title: "Audio",
        body: "PCM16 mono at 24 kHz. Client event input_audio_buffer.append sends base64 frames. Server event response.output_audio.delta returns base64 frames. Stop scheduled playback on input_audio_buffer.speech_started.",
      },
      {
        title: "Echo",
        body: "Never send the agent's own audio back. On open speakers the mic records the agent, server VAD reads it as the caller, and the agent answers itself with its own lines showing up as user transcripts. Use input with acoustic echo cancellation - a headset, a phone line, or getUserMedia({ audio: { echoCancellation: true } }) in the browser - or stop sending input_audio_buffer.append while the agent's audio is still playing, which costs barge-in. The SDKs ship this as echo_suppression=\"half_duplex\" (Python) and echoSuppression: \"half_duplex\" (TypeScript).",
      },
      {
        title: "VAD / interruptions",
        body: "Server VAD emits input_audio_buffer.speech_started and speech_stopped. On speech_started the player must cancel queued audio and the client may send response.cancel. Greeting audio is flushed as soon as the socket attaches.",
      },
      {
        title: "Tools",
        body: "Function tools on the agent run server-side (webhooks, Composio, builtins such as end_call). The socket still emits response.function_call_arguments.delta/done so clients can observe calls. Do not expect a LiveKit data-channel tool bridge.",
      },
      {
        title: "Voices",
        body: "session.voice is a sanitized name: lowercase, spaces to _, strip ' \" ~ ` | / \\ ? > < . , ; : { [ } ] + = *, keep [a-z0-9_], collapse _. Lookup is among catalog voices, public clones, and the caller's private clones. Unknown or inaccessible names return an OpenAI-style error event.",
      },
      {
        title: "Usage",
        body: "response.done.usage is OpenAI-shaped (total_tokens, input_tokens, output_tokens, input_token_details, output_token_details). STT audio maps to input audio tokens, LLM prompt/completion to text tokens, TTS to output audio tokens. Channel is web. Telephony minutes are never written.",
      },
    ],
  },
  {
    slug: "kupe-mcp",
    title: "Kupe MCP",
    description: "Use Kupe from Cursor, Claude Code, or Codex — agents, campaigns, phones, voices, and more as MCP tools.",
    kind: "robot",
    tone: "emerald",
    headline: "Point your coding agent at http://mcp.kupe.in/mcp with your API key.",
    about:
      "kupe-mcp is a FastMCP server that wraps the same /v1 API. Hosted at http://mcp.kupe.in/mcp (HTTP until TLS is live). Send Authorization: Bearer sk-kupe-... on every request. Opening the URL in a browser will fail with Not Acceptable — it is a streamable MCP endpoint (Accept: text/event-stream), not a web page. Use Cursor, Claude Code, Codex, or another MCP client.",
    endpoints: [
      { method: "POST", path: "/mcp", summary: "Streamable HTTP MCP (JSON-RPC). Requires Accept: text/event-stream." },
    ],
    curlTabs: [
      {
        id: "cursor",
        label: "cursor",
        code: `{
  "mcpServers": {
    "kupe": {
      "url": "${MCP_REMOTE_URL}",
      "headers": {
        "Authorization": "Bearer $KUPE_API_KEY"
      }
    }
  }
}`,
      },
      {
        id: "claude",
        label: "claude-code",
        code: `claude mcp add --transport http kupe ${MCP_REMOTE_URL} \\
  --header "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "codex",
        label: "codex",
        code: `[mcp_servers.kupe]
url = "${MCP_REMOTE_URL}"
[mcp_servers.kupe.http_headers]
Authorization = "Bearer $KUPE_API_KEY"
`,
      },
      {
        id: "stdio",
        label: "stdio",
        code: `# Local process fallback (no remote URL)
# uvx kupe-mcp   OR   python -m app.server --mcp
{
  "mcpServers": {
    "kupe": {
      "command": "uvx",
      "args": ["kupe-mcp"],
      "env": {
        "KUPE_API_KEY": "$KUPE_API_KEY"
      }
    }
  }
}`,
      },
    ],
    sections: [
      {
        title: "Auth",
        body: "Every tool call forwards Authorization: Bearer to kupe-backend. Missing header → 401. Use a project API key (sk-kupe-...).",
      },
      {
        title: "Not a browser page",
        body: "http://mcp.kupe.in/mcp speaks MCP streamable HTTP. Safari/Chrome without Accept: text/event-stream get JSON-RPC -32600 Not Acceptable. Install via Cursor Settings → MCP, or the coding-tool dropdown on this page.",
      },
    ],
  },
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
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
session = client.sessions.create(
    org_id="<org_id>",
    project_id="<project_id>",
    agent_id="<agent_id>",
    channel="telephony",
    provider="plivo",
)
print(session.id)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const session = await kupe.sessions.create({
  org_id: "<org_id>",
  project_id: "<project_id>",
  agent_id: "<agent_id>",
  channel: "telephony",
  provider: "plivo",
});
console.log(session.id);
`),
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
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
batch = client.campaigns.create(
    org_id="<org_id>",
    project_id="<project_id>",
    agent_id="<agent_id>",
    telephony_account_id="<telephony_account_id>",
    name="Q3 renewal dials",
    max_concurrent_calls=5,
)
client.campaigns.start(batch.id)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const batch = await kupe.campaigns.create({
  org_id: "<org_id>",
  project_id: "<project_id>",
  agent_id: "<agent_id>",
  telephony_account_id: "<telephony_account_id>",
  name: "Q3 renewal dials",
  max_concurrent_calls: 5,
});
await kupe.campaigns.start(batch.id);
`),
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
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
lst = client.recipient_lists.create(
    org_id="<org_id>",
    project_id="<project_id>",
    name="Q3 renewals — West",
)
client.campaigns.attach_list(batch_id="<batch_id>", recipient_list_id=lst.id)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const list = await kupe.recipientLists.create({
  org_id: "<org_id>",
  project_id: "<project_id>",
  name: "Q3 renewals — West",
});
await kupe.campaigns.attachList({
  batch_id: "<batch_id>",
  recipient_list_id: list.id,
});
`),
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
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
client.inbound.create(
    org_id="<org_id>",
    project_id="<project_id>",
    agent_id="<agent_id>",
    telephony_account_id="<telephony_account_id>",
    name="Support inbound",
    availability={"always": True, "timezone": "Asia/Kolkata"},
)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
await kupe.inbound.create({
  org_id: "<org_id>",
  project_id: "<project_id>",
  agent_id: "<agent_id>",
  telephony_account_id: "<telephony_account_id>",
  name: "Support inbound",
  availability: { always: true, timezone: "Asia/Kolkata" },
});
`),
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
      "Configure call_transfer on an agent's config with one or more named destinations. Each destination has a name and a when-to-transfer description (used by the transfer_call tool), plus an ordered list of numbers. Sequential ring tries numbers in order for ring_timeout_seconds each; simultaneous rings them all. The agent speaks transfer_message then leaves; the caller stays on the original call until someone answers. Do not set no_answer_message — the agent is gone after transfer.",
    endpoints: [
      { method: "PATCH", path: "/v1/agents/{agent_id}", summary: "Set config.call_transfer.destinations (name, when to transfer, numbers, ring order)." },
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
            "description": "Caller asks for sales, pricing, or a human closer",
            "ring_strategy": "sequential",
            "ring_timeout_seconds": 20,
            "numbers": [
              { "number": "+9198XXXXXXX1", "label": "Primary" },
              { "number": "+9198XXXXXXX2", "label": "Fallback" }
            ],
            "transfer_message": "One moment, I am transferring you now."
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
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
transcript = client.logs.transcript("<session_id>")
print(transcript)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const transcript = await kupe.logs.transcript("<session_id>");
console.log(transcript);
`),
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
    slug: "databases",
    title: "Databases",
    description: "Tables of structured data extracted after every call.",
    kind: "batch",
    tone: "violet",
    headline: "Every call writes a row. Destinations fire on write.",
    about:
      "A Database is a Notion-like table of post-call fields. Creating an agent auto-provisions one (summary, success, plus a few columns inferred from the prompt). Attach more agents, edit columns, and sync rows to a webhook, Composio action, or catalog HTTP tool. Rows paginate with a keyset cursor, not offset.",
    endpoints: [
      { method: "GET", path: "/v1/orgs/{org_id}/projects/{project_id}/databases", summary: "List databases in a project." },
      { method: "POST", path: "/v1/orgs/{org_id}/projects/{project_id}/databases", summary: "Create a database and its extraction schema." },
      { method: "GET", path: "/v1/databases/{database_id}", summary: "Get a database, including columns." },
      { method: "PATCH", path: "/v1/databases/{database_id}", summary: "Rename or change columns and destinations." },
      { method: "POST", path: "/v1/databases/{database_id}/archive", summary: "Archive a database." },
      { method: "POST", path: "/v1/databases/{database_id}/agents", summary: "Attach an agent so its calls write rows." },
      { method: "DELETE", path: "/v1/databases/{database_id}/agents/{agent_id}", summary: "Detach an agent." },
      { method: "GET", path: "/v1/databases/{database_id}/rows", summary: "Keyset page of rows. Pass cursor= from next_cursor." },
      { method: "GET", path: "/v1/databases/{database_id}/export", summary: "Stream csv, json, ndjson, or zip." },
      { method: "GET", path: "/v1/agents/{agent_id}/databases", summary: "List databases attached to an agent (lazy-provisions a default)." },
    ],
    curlTabs: [
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
rows = client.databases.rows.list("<database_id>", limit=50)
client.databases.export("<database_id>", format="csv")
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const rows = await kupe.databases.rows.list("<database_id>", { limit: 50 });
await kupe.databases.export("<database_id>", { format: "csv" });
`),
      {
        id: "list-rows",
        label: "list-rows",
        code: `curl "${API_BASE_URL}/v1/databases/<database_id>/rows?limit=50" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "export-csv",
        label: "export-csv",
        code: `curl "${API_BASE_URL}/v1/databases/<database_id>/export?format=csv" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -o database.csv`,
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
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
wallet = client.billing.wallet.retrieve("<org_id>", currency="USD")
invoices = client.billing.invoices.list("<org_id>", currency="USD")
print(wallet.balance, invoices)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const wallet = await kupe.billing.wallet.retrieve("<org_id>", { currency: "USD" });
const invoices = await kupe.billing.invoices.list("<org_id>", { currency: "USD" });
console.log(wallet.balance, invoices);
`),
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
      "Agents are versioned: every PATCH creates a new version and you can list or revert to any prior one. An agent's config carries its provider selection (llm_id, stt_id, tts_id, tts_voice_id), system prompt, tools, call-transfer destinations, and call-behavior knobs such as thinking_sounds and config.tts speaking controls — everything the voice-agents UI edits is available here too. GET /v1/providers returns tts_providers[].capabilities.speaking: the sliders that model actually honors (speaking_speed on most TTS; pitch on Deepgram and Sarvam v2; loudness on Sarvam v2; temperature on Sarvam v3; volume and emotion on Cartesia; stability, similarity_boost, style, speaker_boost on ElevenLabs). PATCH config.tts with only those keys. Set config.thinking_sounds.mode to say something through the agent's TTS the instant the caller finishes speaking, before the real reply audio starts. Four modes: \"off\" (silence), \"sounds\" (a hesitation — hmm / अं / ம்ம்), \"words\" (a short acknowledgement in the agent's language — अच्छा / ठीक है / બરાબર / சரி / \"got it\"), or \"auto\" (ThinkSpark — an ultra-light on-device model that picks a context-aware spark from the caller's last turn + the conversation, in the right language/script/tone, and stays silent when nothing fits; the agent's own LLM reply then skips the acknowledgement). The wording follows config.llm.language, so there is no text to author. config is deep-merged on PATCH, so send only the keys you are changing. See Workspace timezone for config.timezone and org defaults; see Caller memory & dynamic greetings for config.memory and config.dynamic_greeting.",
    endpoints: [
      { method: "POST", path: "/v1/orgs/{org_id}/projects/{project_id}/agents", summary: "Create an agent." },
      { method: "GET", path: "/v1/orgs/{org_id}/projects/{project_id}/agents", summary: "List agents, paginated." },
      { method: "GET", path: "/v1/agents/{agent_id}", summary: "Get an agent's current config." },
      { method: "PATCH", path: "/v1/agents/{agent_id}", summary: "Update an agent — creates a new version. Pass config.thinking_sounds.mode: off | sounds | words | auto (ThinkSpark). Pass config.tts for speaking knobs (speed, pitch, Cartesia volume/emotion, ElevenLabs stability, …); only fields in GET /v1/providers tts_providers[].capabilities.speaking apply to that model." },
      { method: "POST", path: "/v1/agents/{agent_id}/commit", summary: "Commit the current draft as a new version. Optional JSON body: { \"message\": \"what changed\" }." },
      { method: "GET", path: "/v1/agents/{agent_id}/versions", summary: "List committed versions. Each item includes version, message, created_at, and snapshot." },
      { method: "POST", path: "/v1/agents/{agent_id}/revert/{version}", summary: "Roll back to a prior version." },
      { method: "POST", path: "/v1/agents/{agent_id}/archive", summary: "Archive an agent." },
      { method: "GET", path: "/v1/agents/{agent_id}/tools", summary: "List tools attached to an agent." },
      { method: "POST", path: "/v1/agents/{agent_id}/tools", summary: "Attach a tool to an agent." },
      { method: "DELETE", path: "/v1/agents/{agent_id}/tools/{tool_id}", summary: "Detach a tool." },
    ],
    curlTabs: [
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
agent = client.agents.create(
    org_id="<org_id>",
    project_id="<project_id>",
    name="Support line",
    system_prompt="You are a helpful support agent for Acme.",
)
client.agents.update(agent.id, greeting="Hi, thanks for calling Acme — how can I help?")
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";

const kupe = new Kupe();
const agent = await kupe.agents.create({
  org_id: "<org_id>",
  project_id: "<project_id>",
  name: "Support line",
  system_prompt: "You are a helpful support agent for Acme.",
});
await kupe.agents.update(agent.id, {
  greeting: "Hi, thanks for calling Acme — how can I help?",
});
`),
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
        code: `# thinking_sounds.mode: "off" | "sounds" | "words" | "auto"
# "auto" = ThinkSpark picks a context-aware spark on-device (CPU)
curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "thinking_sounds": { "mode": "auto" }
    }
  }'`,
      },
      {
        id: "speaking",
        label: "speaking",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "tts": {
        "speaking_speed": 1.05,
        "volume": 1.1,
        "emotion": "calm"
      }
    }
  }'`,
      },
    ],
  },
  {
    slug: "workspace-timezone",
    title: "Workspace timezone",
    description: "Set the local time agents use for scheduling, “today”, and time-sensitive answers.",
    kind: "building",
    tone: "amber",
    headline: "Give every agent the correct local date and time.",
    about:
      "Every voice session gets a # Local time block appended to the agent's system prompt at call start — e.g. \"Thursday, 20 August 2026, 3:30 PM IST (Asia/Kolkata)\" — so the model can answer \"what time is it?\", booking windows, and \"call me tomorrow\" without you hard-coding dates in the prompt.\n\nResolution order: agent config.timezone → org timezone → Asia/Kolkata (default). Set the workspace default once with PATCH /v1/orgs/{org_id}. Override per agent with PATCH /v1/agents/{agent_id} and config.timezone. Omit config.timezone or set it to null on an agent to inherit the org default again. Use IANA names (Asia/Kolkata, America/New_York, Europe/London, …). config is deep-merged on agent PATCH, so you can send only { \"config\": { \"timezone\": \"…\" } }.\n\nMCP: get_org / update_org for the workspace default; update_agent with config.timezone for per-agent overrides.",
    endpoints: [
      { method: "GET", path: "/v1/orgs/{org_id}", summary: "Read org settings including timezone (default Asia/Kolkata)." },
      { method: "PATCH", path: "/v1/orgs/{org_id}", summary: "Set workspace timezone and/or country. Body: { timezone?: string, country?: string } — at least one field required." },
      { method: "GET", path: "/v1/agents/{agent_id}", summary: "Read an agent; check config.timezone (null = inherit org default)." },
      { method: "PATCH", path: "/v1/agents/{agent_id}", summary: "Override config.timezone for one agent. Deep-merge — send only the keys you change." },
    ],
    curlTabs: [
      {
        id: "get-org",
        label: "get-org",
        code: `curl "${API_BASE_URL}/v1/orgs/<org_id>" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "org-timezone",
        label: "org-timezone",
        code: `curl -X PATCH ${API_BASE_URL}/v1/orgs/<org_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{ "timezone": "Asia/Kolkata" }'`,
      },
      {
        id: "agent-timezone",
        label: "agent-timezone",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "timezone": "America/New_York"
    }
  }'`,
      },
      {
        id: "inherit-org-default",
        label: "inherit-org-default",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "timezone": null
    }
  }'`,
      },
    ],
  },
  {
    slug: "caller-memory",
    title: "Caller memory & dynamic greetings",
    description: "Let an agent remember past calls with a number, and open each call from that context.",
    kind: "person",
    tone: "emerald",
    headline: "Agents remember who called before — and can write their opening line from it.",
    about:
      "config.memory is on by default for telephony calls: when a call ends, Kupe summarizes it and stores that summary against the caller's phone number (normalized to E.164, so 9173063080 and +919173063080 are the same person). On their next call the newest max_calls summaries — plus durable facts the summarizer extracted, like preferred name, language, and anything still owed — are appended to the agent's system prompt with instructions to use them like someone who genuinely remembers the caller rather than someone reading a file. Web test calls from the dashboard do not read or write memory — each test session is stateless. Nothing is stored for a call that never became a conversation, and summaries are deleted automatically once they pass retention_days (1–365, default 30). scope decides reach: \"agent\" keeps each agent's history separate, \"project\" gives every agent in the project one shared history per caller.\n\nconfig.dynamic_greeting builds on it. Off, the agent speaks its greeting field verbatim and dynamic_greeting.instructions is ignored. On, greeting is ignored and the session's own LLM writes the opening line from the same prompt the call runs on — recalled memory and resolved {{variables}} included — steered by dynamic_greeting.instructions, and streams it into TTS sentence by sentence so the first words start synthesizing before the sentence after them exists. If generation is too slow or the provider errors, the call waits for the caller rather than speaking the unused first message. Turning memory off leaves dynamic greetings with no history to open on, so the generated line becomes a plain warm greeting rather than a personalized one.\n\nStored memories are readable and erasable per caller. GET the memories endpoint to see exactly what an agent will carry into the next call; DELETE it to answer a \"forget me\" request — that is immediate and permanent, and it requires a contact, so there is no way to wipe every caller at once. Deleting is not the same as opting out: future calls are still summarized until you patch config.memory.enabled to false.",
    endpoints: [
      { method: "PATCH", path: "/v1/agents/{agent_id}", summary: "Set config.memory (enabled, retention_days, max_calls, scope) or config.dynamic_greeting (enabled, instructions). config is deep-merged, so a one-key patch keeps the rest." },
      { method: "GET", path: "/v1/agents/{agent_id}/memories", summary: "List stored memories, newest first, paginated. Optional ?contact= narrows to one caller in any common phone format." },
      { method: "DELETE", path: "/v1/agents/{agent_id}/memories", summary: "Erase every memory for one caller. ?contact= is required. Returns { contact_key, deleted }." },
      { method: "GET", path: "/v1/agents/{agent_id}", summary: "Read an agent's current memory and greeting configuration." },
    ],
    curlTabs: [
      {
        id: "configure-memory",
        label: "configure-memory",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "memory": {
        "enabled": true,
        "retention_days": 60,
        "max_calls": 5,
        "scope": "agent"
      }
    }
  }'`,
      },
      {
        id: "dynamic-greeting",
        label: "dynamic-greeting",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "greeting": "Hi, this is Asha from Acme — how can I help?",
    "config": {
      "dynamic_greeting": {
        "enabled": true,
        "instructions": "If they have an unpaid invoice, mention the due date before anything else."
      }
    }
  }'`,
      },
      {
        id: "read-memories",
        label: "read-memories",
        code: `curl "${API_BASE_URL}/v1/agents/<agent_id>/memories?contact=9173063080&limit=5" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "forget-caller",
        label: "forget-caller",
        code: `curl -X DELETE "${API_BASE_URL}/v1/agents/<agent_id>/memories?contact=%2B919173063080" \\
  -H "Authorization: Bearer $KUPE_API_KEY"`,
      },
      {
        id: "disable-memory",
        label: "disable-memory",
        code: `curl -X PATCH ${API_BASE_URL}/v1/agents/<agent_id> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $KUPE_API_KEY" \\
  -d '{
    "config": {
      "memory": { "enabled": false }
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
      { method: "DELETE", path: "/v1/voices/{voice_id}", summary: "Delete a cloned voice you own. Pass fallback_voice_id when agents still use it." },
      { method: "GET", path: "/v1/voices/{voice_id}/usage", summary: "How many live agents still use this cloned voice." },
    ],
    curlTabs: [
      sdkPython(`# pip install kupe
from kupe import Kupe

client = Kupe()
voice = client.voices.clone(name="Priya", sample=open("priya-sample.wav", "rb"))
print(voice.id)
`),
      sdkTypescript(`// npm install kupe-sdk
import { Kupe } from "kupe-sdk";
import { readFile } from "node:fs/promises";

const kupe = new Kupe();
const sample = await readFile("priya-sample.wav");
const voice = await kupe.voices.clone({ name: "Priya", sample, is_public: false });
console.log(voice.id);
`),
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
