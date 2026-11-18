import { CircleAlert } from "lucide-react";
import { Card, Pill, type Tone } from "@/components/ui";
import type { Case } from "@/lib/api";
import { limitation, longDate, parseISODate, type LimitationStatus } from "@/lib/limitation";

const STATUS: Record<LimitationStatus, { label: string; tone: Tone; bar: string; text: string }> = {
  ok: { label: "In time", tone: "ok", bar: "bg-ok", text: "text-ok" },
  soon: { label: "Ends within a year", tone: "warn", bar: "bg-warn", text: "text-warn" },
  expired: { label: "Expired", tone: "bad", bar: "bg-bad", text: "text-bad" },
};

const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function initials(name: string) {
  const words = name
    .replace(/\b(ltd|limited|plc|llp)\b\.?/gi, "")
    .split(/\s+/)
    .filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

function Party({ name, role, tone }: { name: string; role: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${tone}`}>
        {initials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        <p className="text-xs text-ink-soft">{role}</p>
      </div>
    </div>
  );
}

function LimitationTimeline({ breachISO }: { breachISO: string }) {
  const breach = parseISODate(breachISO);
  const { expiry, status, elapsed, remaining } = limitation(breach);
  const s = STATUS[status];
  const pct = Math.round(elapsed * 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Limitation period</h3>
        <Pill tone={s.tone}>{s.label}</Pill>
      </div>

      <p className={`mt-2 text-sm font-medium ${s.text}`}>
        {status === "expired" ? `Ended ${remaining} ago` : `${remaining} left to issue a claim`}
      </p>

      <div className="relative mt-4 mb-1">
        <div className="h-2 overflow-hidden rounded-full bg-line-soft">
          <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
        </div>
        {status !== "expired" && (
          <span
            className="absolute -top-1 h-4 w-0.5 rounded bg-ink"
            style={{ left: `calc(${pct}% - 1px)` }}
            title="Today"
            aria-hidden
          />
        )}
      </div>
      <div className="flex justify-between gap-3 text-xs">
        <div>
          <p className="text-ink-soft">Breach</p>
          <p className="font-medium">{shortDate(breach)}</p>
        </div>
        <div className="text-right">
          <p className="text-ink-soft">{status === "expired" ? "Ended" : "Ends"}</p>
          <p className="font-medium">{shortDate(expiry)}</p>
        </div>
      </div>
      <p className="sr-only">
        Breach on {longDate(breach)}. Limitation period {status === "expired" ? "ended" : "ends"} on{" "}
        {longDate(expiry)}.
      </p>
      <p className="mt-3 text-xs text-ink-faint">Six years for a simple contract, Limitation Act 1980, s.5.</p>
    </div>
  );
}

export default function CaseDetails({ c }: { c: Case }) {
  return (
    <Card title="Case details">
      <div className="space-y-3">
        <Party name={c.client_name} role="Client" tone="bg-brand-tint text-brand" />
        <div className="flex items-center gap-3 pl-3 text-xs text-ink-faint" aria-hidden>
          <span className="h-4 w-px bg-line" />v
        </div>
        <Party name={c.counterparty} role="Counterparty" tone="bg-line-soft text-ink-soft" />
      </div>

      <div className="mt-5 border-t border-line-soft pt-5">
        {c.breach_date ? (
          <LimitationTimeline breachISO={c.breach_date} />
        ) : (
          <div className="flex gap-2 rounded-md bg-warn-tint px-3 py-2.5 text-sm text-warn">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            <p>Breach date unknown, so the limitation period can&apos;t be checked yet.</p>
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-line-soft pt-3 text-xs text-ink-soft">
        Opened {longDate(new Date(c.created_at))}
      </p>
    </Card>
  );
}
