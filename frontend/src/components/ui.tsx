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

/** A grey placeholder block for skeleton screens. Hidden from screen readers; wrap it in Loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-line ${className}`} />;
}

/** Announces a loading region once, for screen readers, around skeleton content. */
export function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Small spinning ring for busy buttons. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}
