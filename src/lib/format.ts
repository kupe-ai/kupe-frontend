/** Small local-date/time formatting helpers used by the date/time pickers. */

/** YYYY-MM-DD in local time. */
export function toDateInput(date: Date | string): string {
  const d =
    typeof date === "string"
      ? new Date(date.includes("T") ? date : `${date}T00:00:00`)
      : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DDTHH:mm in local time (for datetime deadlines). */
export function toDateTimeLocal(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = toDateInput(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}T${hh}:${mm}`;
}

/** Date portion of YYYY-MM-DD or YYYY-MM-DDTHH:mm. */
export function datePart(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Time portion HH:mm when present. */
export function timePart(value: string): string {
  if (!value) return "";
  if (/^\d{2}:\d{2}/.test(value) && value.length <= 5) return value.slice(0, 5);
  const t = value.includes("T") ? value.split("T")[1] : "";
  return t ? t.slice(0, 5) : "";
}

/** Human-friendly date (15 Jan 2026). */
export function formatDate(date: Date | string): string {
  const raw = typeof date === "string" ? datePart(date) || date : date;
  const d =
    typeof raw === "string"
      ? new Date(raw.includes("T") ? raw : `${raw}T00:00:00`)
      : raw;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Date, or date + time when a time is stored (15 Jan 2026, 2:30 pm). */
export function formatDateTimeValue(value: string): string {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }
  const day = datePart(value);
  const time = timePart(value);
  if (!time) return formatDate(day);
  const d = new Date(`${day}T${time}:00`);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
