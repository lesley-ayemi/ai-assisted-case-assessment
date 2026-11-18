import type { LucideIcon } from "lucide-react";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60",
};

export const field =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
          <h2 className="font-medium">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-brand-tint text-brand">
          <Icon size={18} aria-hidden />
        </span>
        <p className="text-sm text-ink-soft">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold whitespace-nowrap tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "neutral" | "brand";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  neutral: "bg-line-soft text-ink-soft",
  brand: "bg-brand-tint text-brand",
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const CASE_STATUS: Record<string, { label: string; tone: Tone }> = {
  intake: { label: "Intake", tone: "neutral" },
  awaiting_review: { label: "Awaiting review", tone: "warn" },
  reviewed: { label: "Reviewed", tone: "ok" },
};

export function caseStatus(status: string) {
  return CASE_STATUS[status] ?? { label: status.replace("_", " "), tone: "neutral" as Tone };
}
