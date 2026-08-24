/** Sanitize TTS voice names for the Realtime API. Keep in sync with
 * kupe-backend/app/shared/voice_names.py.
 */
const STRIP = /["'~`|/\\?><.,;:{}[\]+=*]/g;

export function sanitizeVoiceName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(STRIP, "")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
