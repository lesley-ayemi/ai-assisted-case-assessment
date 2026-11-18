// Limitation Act 1980, s.5: six years from the date the cause of action accrued (for breach of
// a simple contract, the date of breach). The backend's rule-based check is authoritative; this
// mirrors it for display only.

export const LIMITATION_YEARS = 6;

export function startOfToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Parses "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be midnight UTC). */
export function parseISODate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** "4 years 10 months", "3 months", "12 days" between two dates (order-independent). */
export function span(a: Date, b: Date) {
  const [from, to] = a <= b ? [a, b] : [b, a];
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (months <= 0) return plural(Math.round((to.getTime() - from.getTime()) / 86_400_000), "day");
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years && plural(years, "year"), rest && plural(rest, "month")].filter(Boolean).join(" ");
}

export type LimitationStatus = "ok" | "soon" | "expired";

export function limitation(breach: Date, today = startOfToday()) {
  const expiry = new Date(breach);
  expiry.setFullYear(expiry.getFullYear() + LIMITATION_YEARS);
  const soon = new Date(today);
  soon.setFullYear(soon.getFullYear() + 1);
  const status: LimitationStatus = expiry < today ? "expired" : expiry < soon ? "soon" : "ok";
  const total = expiry.getTime() - breach.getTime();
  const elapsed = Math.min(1, Math.max(0, (today.getTime() - breach.getTime()) / total));
  return { expiry, status, elapsed, remaining: span(today, expiry) };
}
