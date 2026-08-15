const STORAGE_KEY = "kupe:cmdk-recent";
const MAX_ITEMS = 8;

export interface RecentActivityItem {
  href: string;
  label: string;
  at: number;
}

export function readRecentActivity(): RecentActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentActivityItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export function pushRecentActivity(href: string, label: string) {
  if (typeof window === "undefined") return;
  try {
    const next: RecentActivityItem[] = [
      { href, label, at: Date.now() },
      ...readRecentActivity().filter((item) => item.href !== href),
    ].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
