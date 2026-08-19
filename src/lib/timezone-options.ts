import { countryFlag } from "@/lib/country-flag";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const PREFERRED_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

/** Map IANA zones to ISO country codes for flag display. */
const TZ_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Dubai": "AE",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Europe/London": "GB",
  "America/New_York": "US",
  "America/Los_Angeles": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Amsterdam": "NL",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Stockholm": "SE",
  "Europe/Dublin": "IE",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Pacific/Auckland": "NZ",
  "Africa/Johannesburg": "ZA",
};

export function countryForTimezone(tz: string): string {
  const direct = TZ_COUNTRY[tz];
  if (direct) return direct;
  if (tz.startsWith("America/")) {
    if (tz.includes("Toronto") || tz.includes("Vancouver") || tz.includes("Winnipeg")) return "CA";
    if (tz.includes("Mexico")) return "MX";
    if (tz.includes("Sao_Paulo") || tz.includes("Bahia")) return "BR";
    return "US";
  }
  if (tz.startsWith("Europe/")) {
    if (tz.includes("London")) return "GB";
    if (tz.includes("Paris")) return "FR";
    if (tz.includes("Berlin")) return "DE";
    if (tz.includes("Dublin")) return "IE";
    if (tz.includes("Stockholm")) return "SE";
    if (tz.includes("Amsterdam")) return "NL";
    if (tz.includes("Madrid")) return "ES";
    if (tz.includes("Rome")) return "IT";
  }
  if (tz.startsWith("Asia/")) {
    if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("Mumbai")) return "IN";
    if (tz.includes("Dubai")) return "AE";
    if (tz.includes("Singapore")) return "SG";
    if (tz.includes("Tokyo")) return "JP";
  }
  if (tz.startsWith("Australia/")) return "AU";
  if (tz.startsWith("Pacific/Auckland")) return "NZ";
  if (tz.startsWith("Africa/Johannesburg")) return "ZA";
  return "";
}

export function timezoneLabel(tz: string): string {
  return tz.replaceAll("_", " ");
}

export function timezoneFlag(tz: string): string {
  const iso = countryForTimezone(tz);
  return iso ? countryFlag(iso) : "🌐";
}

export function listTimezoneValues(): string[] {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          "timeZone",
        )
      : [...PREFERRED_TIMEZONES];
  const seen = new Set<string>();
  return [...PREFERRED_TIMEZONES, ...supported].filter((tz) => {
    if (seen.has(tz)) return false;
    seen.add(tz);
    return true;
  });
}
