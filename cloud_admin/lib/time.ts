/** RFC3339 UTC with second precision, e.g. 2026-10-16T22:01:00Z. */
export function toRfc3339(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Parses an incoming timestamp string; returns null for empty or invalid input. */
export function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function appTimeZone(): string {
  return process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Today's date as YYYY-MM-DD in the church's time zone. */
export function todayDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: appTimeZone(),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatRelative(value: Date | null | undefined): string {
  if (!value) return "never";
  const seconds = Math.round((Date.now() - value.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
