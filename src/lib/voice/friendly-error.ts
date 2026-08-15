import { KoriApiError } from "@/lib/api/kori-errors";

/**
 * Map API/transport failures to short, human copy for toasts and empty states.
 * Prefer backend detail when it's already plain English; never dump stack traces.
 */
export function friendlyVoiceError(err: unknown, fallback: string): string {
  if (!err) return fallback;

  if (err instanceof KoriApiError) {
    const msg = (err.message || "").trim();
    if (!msg || msg === "Request failed") return fallback;

    if (err.status === 401 || err.status === 403) {
      return "You're signed out or don't have access. Try signing in again.";
    }
    if (err.status === 404) {
      return "We couldn't find that. It may have been deleted.";
    }
    if (err.status === 429) {
      return "Too many requests — wait a moment and try again.";
    }
    if (err.status >= 500) {
      return "Something went wrong on our side. Please try again.";
    }

    // Already-friendly backend messages (providers, LiveKit, etc.)
    if (msg.length <= 160 && !looksTechnical(msg)) return msg;
    if (/no (default )?(llm|tts|stt) provider/i.test(msg)) {
      return "Pick an LLM, voice, and speech recognition in Settings first.";
    }
    if (/livekit|websocket|room/i.test(msg)) {
      return "Couldn't connect the call. Make sure voice calling is set up, then try again.";
    }
    return fallback;
  }

  if (err instanceof Error) {
    const msg = err.message.trim();
    if (msg && msg.length <= 120 && !looksTechnical(msg)) return msg;
  }

  return fallback;
}

function looksTechnical(msg: string): boolean {
  return (
    /traceback|exception|sqlalchemy|postgrest|ECONNREFUSED|TypeError|undefined is not/i.test(
      msg,
    ) || msg.includes("{")
  );
}
