# Kupe frontend

Separate Vite + React app. Users sign up / sign in via Supabase Auth
(`@supabase/supabase-js`, calling Supabase directly — the frontend never
talks to CRUD for auth itself), then talks to the CRUD API (with the
resulting JWT as a Bearer token) to create a voice session and join LiveKit
with the short-lived token CRUD returns. Session/usage/recording history is
read directly from Supabase (RLS-protected by the signed-in user's own JWT).

```bash
cp .env.example .env
# VITE_BACKEND_URL=http://localhost:8000
# VITE_SUPABASE_URL=... / VITE_SUPABASE_ANON_KEY=...  (Supabase dashboard: Settings > API)
npm install
npm run dev
```

Open http://localhost:5173. Start `kupe-livekit`, `kupe-backend` (with a
Supabase project's schema already migrated), and `kupe-agents` first — see
`../kupe-backend/README.md`.

## Auth

Sign up creates a Supabase auth user; `kupe-backend`'s signup trigger
auto-provisions a personal organization + default project, so there's
nothing else to set up before creating a session. `src/lib/useAuth.ts`
tracks the current session; `src/lib/useOrgContext.ts` picks the first
org/project (no picker in this UI yet — multi-org support is a natural
later addition).

`src/lib/api.ts` is the single shared authed-fetch helper used for every
CRUD call (attaches the current Supabase JWT as `Authorization: Bearer`).
Sessions/usage/recordings history (`src/HistoryPanel.tsx`) mixes direct
Supabase reads (for data with no dedicated CRUD endpoint, like the session
list) with CRUD's summarized usage endpoint — the same hybrid pattern the
backend was designed around.

Only the LiveKit/WebRTC transport is wired up in this UI (`transport:
"livekit"`, the default) — the Realtime WS gateway is for API clients that
want an OpenAI-Realtime-shaped integration, not this browser UI.
