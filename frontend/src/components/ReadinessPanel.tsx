import { CircleAlert, CircleCheck, CircleDashed, TrendingUp } from "lucide-react";
import { Card, Pill, type Tone } from "@/components/ui";
import { ELEMENT_LABELS, type Assessment } from "@/lib/api";

type ElementScore = Assessment["readiness"]["elements"][number];

// Mirrors backend/app/services/readiness.py: two or more facts earn full credit, one earns half.
const CREDIT: Record<ElementScore["status"], number> = { supported: 1, weak: 0.5, missing: 0 };

const STATUS: Record<ElementScore["status"], { label: string; tone: Tone; icon: typeof CircleCheck; color: string }> = {
  supported: { label: "Supported", tone: "ok", icon: CircleCheck, color: "text-ok" },
  weak: { label: "Weak", tone: "warn", icon: CircleAlert, color: "text-warn" },
  missing: { label: "Missing", tone: "bad", icon: CircleDashed, color: "text-bad" },
};

// Kept exact (a weak 15-point element earns 7.5) so the rows add up to the unrounded total.
const points = (el: ElementScore) => ({
  earned: Math.round(el.weight * 100 * CREDIT[el.status] * 10) / 10,
  max: Math.round(el.weight * 100),
});

/** One bar, one segment per element sized by its weight and filled by the credit it earned. */
function ScoreBar({ elements }: { elements: ElementScore[] }) {
  return (
    <div className="flex h-3 gap-0.5" aria-hidden>
      {elements.map((el) => (
        <div
          key={el.element}
          className="relative overflow-hidden rounded-sm bg-line-soft first:rounded-l-full last:rounded-r-full"
          style={{ flexGrow: el.weight }}
          title={`${ELEMENT_LABELS[el.element]}: ${points(el).earned} of ${points(el).max}`}
        >
          <div
            className={`h-full ${el.status === "supported" ? "bg-brand" : "bg-brand/55"}`}
            style={{ width: `${CREDIT[el.status] * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function ReadinessPanel({ readiness }: { readiness: Assessment["readiness"] }) {
  const { elements, score, flags, excluded_facts } = readiness;
  const gains = elements
    .map((el) => ({ el, gain: points(el).max - points(el).earned }))
    .filter((g) => g.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2);

  return (
    <Card title="Evidence readiness" action={<span className="text-2xl font-semibold tabular-nums">{score}/100</span>}>
      <ScoreBar elements={elements} />
      <p className="mt-3 text-sm text-ink-soft">
        How completely the evidence covers each element of the claim. Not a prediction of outcome.
      </p>
      {!!excluded_facts && (
        <p className="mt-2 text-sm text-bad">
          {excluded_facts} {excluded_facts === 1 ? "fact" : "facts"} left out of the score because the quote was not
          found in the source.
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs text-ink-soft">
            <tr>
              <th className="px-4 py-2 font-medium">Element</th>
              <th className="px-2 py-2 text-right font-medium">Facts</th>
              <th className="px-2 py-2 text-right font-medium">Points</th>
              <th className="px-4 py-2 text-right font-medium">
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {elements.map((el) => {
              const s = STATUS[el.status];
              const p = points(el);
              const Icon = s.icon;
              return (
                <tr key={el.element}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Icon size={16} className={`shrink-0 ${s.color}`} aria-hidden />
                      {ELEMENT_LABELS[el.element]}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-ink-soft tabular-nums">{el.fact_count}</td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap tabular-nums">
                    <span className="font-medium">{p.earned}</span>
                    <span className="text-ink-faint"> / {p.max}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-ink-faint">
        Points depend on each element&apos;s weight: two or more facts earn full points, one earns half, none earns
        nothing.
      </p>

      {gains.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-brand-tint px-3 py-2.5 text-sm text-brand">
          <TrendingUp size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Most to gain:{" "}
            {gains.map((g, i) => (
              <span key={g.el.element}>
                {i > 0 && " and "}
                <strong className="font-medium">{ELEMENT_LABELS[g.el.element]}</strong> (+{g.gain})
              </span>
            ))}
            . Evidence for {gains.length === 1 ? "it" : "these"} would raise the score most.
          </span>
        </p>
      )}

      {flags.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-md bg-warn-tint px-4 py-3 text-sm text-warn">
          {flags.map((f) => (
            <li key={f} className="flex gap-2">
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
