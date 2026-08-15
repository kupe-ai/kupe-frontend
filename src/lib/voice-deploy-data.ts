import type { AsciiIconKind, AsciiIconTone } from "@/components/voice-agents/ascii-icons";

export type DeployApiSlug =
  | "instant-outbound"
  | "batch-outbound"
  | "inbound-deployments"
  | "data-fetch"
  | "agents-sdk"
  | "dnd-lists";

export type DeployRecipeSlug =
  | "moengage"
  | "outbound-callback"
  | "embed-website";

export interface DeployApiCard {
  slug: DeployApiSlug;
  title: string;
  description: string;
  kind: AsciiIconKind;
  tone: AsciiIconTone;
  headline: string;
  about: string;
  curlTabs: { id: string; label: string; code: string }[];
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
    slug: "instant-outbound",
    title: "Instant outbound",
    description: "Place a single outbound call with one API request.",
    kind: "outbound",
    tone: "sky",
    headline: "Place one outbound call with a single request.",
    about:
      "Fire a single outbound call to a recipient. Ideal for transactional triggers from your backend.",
    curlTabs: [
      {
        id: "create-call",
        label: "create-call",
        code: `curl -X POST https://api.kori.app/v1/calls \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your-api-key>" \\
  -d '{
    "agent_id": "<agent_id>",
    "to": "+9198XXXXXXXX",
    "variables": { "userName": "Divya" }
  }'`,
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
      "A campaign ties an agent to a schedule, dial rate, and retry policy using CSV cohorts. Cohorts are processed independently and can be queued.",
    curlTabs: [
      {
        id: "create-campaign",
        label: "create-campaign",
        code: `curl -X POST https://api.kori.app/v1/orgs/{org_id}/workspaces/{workspace_id}/campaigns \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your-api-key>" \\
  -d '{
    "name": "My campaign",
    "app_config": {
      "app_id": "<agent_id>",
      "app_version": "v1",
      "app_type": "agent",
      "attempts_per_second": 2
    },
    "connection_configs": []
  }'`,
      },
      {
        id: "upload-cohort",
        label: "upload-cohort",
        code: `curl -X POST https://api.kori.app/v1/campaigns/{campaign_id}/cohorts \\
  -H "X-API-Key: <your-api-key>" \\
  -F "file=@contacts.csv"`,
      },
      {
        id: "pause-resume",
        label: "pause / resume",
        code: `curl -X POST https://api.kori.app/v1/campaigns/{campaign_id}/pause \\
  -H "X-API-Key: <your-api-key>"`,
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
      "Bind an agent version to a rented or imported number and route inbound traffic automatically.",
    curlTabs: [
      {
        id: "deploy",
        label: "deploy",
        code: `curl -X POST https://api.kori.app/v1/inbound \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your-api-key>" \\
  -d '{
    "name": "Support line",
    "agent_id": "<agent_id>",
    "phone_number": "+9111XXXXXXXX"
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
      "Query interactions by time window, campaign, or agent and download recordings or transcripts.",
    curlTabs: [
      {
        id: "list",
        label: "list-interactions",
        code: `curl "https://api.kori.app/v1/interactions?from=2026-07-26&to=2026-08-01" \\
  -H "X-API-Key: <your-api-key>"`,
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
      "Use the Agents SDK to define prompts, tools, and voices in code, then publish versions to Kupe.",
    curlTabs: [
      {
        id: "publish",
        label: "publish",
        code: `npx @kori/agents publish ./agent \\
  --api-key <your-api-key>`,
      },
    ],
  },
  {
    slug: "dnd-lists",
    title: "DND lists",
    description: "Manage do not disturb lists.",
    kind: "forbidden",
    tone: "violet",
    headline: "Respect do-not-disturb preferences at dial time.",
    about:
      "Upload and sync DND numbers so campaigns and instant outbound skip opted-out contacts.",
    curlTabs: [
      {
        id: "upload",
        label: "upload-dnd",
        code: `curl -X POST https://api.kori.app/v1/dnd \\
  -H "X-API-Key: <your-api-key>" \\
  -F "file=@dnd.csv"`,
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
