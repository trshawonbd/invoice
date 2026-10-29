export type Range = "today" | "7d" | "1m" | "3m" | "all";

export const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "1m", label: "1 month" },
  { id: "3m", label: "3 months" },
  { id: "all", label: "All" },
];

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const today = () => isoDate(new Date());

/** First ISO date included in the range, or null for "all". */
export function rangeStart(range: Range): string | null {
  const d = new Date();
  switch (range) {
    case "today":
      return isoDate(d);
    case "7d":
      d.setDate(d.getDate() - 6);
      return isoDate(d);
    case "1m":
      d.setMonth(d.getMonth() - 1);
      return isoDate(d);
    case "3m":
      d.setMonth(d.getMonth() - 3);
      return isoDate(d);
    case "all":
      return null;
  }
}

/** Number of days the range covers, used to project yearly totals. */
export function rangeDays(range: Range, earliest?: string): number {
  const start = rangeStart(range) ?? earliest;
  if (!start) return 1;
  const ms = new Date(today()).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function startOfMonth(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  if (iso === today()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === isoDate(y)) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}
