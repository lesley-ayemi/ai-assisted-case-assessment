import { ELEMENT_LABELS, type Assessment } from "@/lib/api";

const DOT: Record<string, string> = { supported: "bg-ok", weak: "bg-warn", missing: "bg-bad" };

function Metric({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold whitespace-nowrap tabular-nums">{value}</p>
      <div className="mt-1.5 text-xs">{children}</div>
    </div>
  );
}

const Status = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className={ok ? "text-ok" : "text-bad"}>{children}</span>
);

/** Four headline figures for an assessment, each with a line saying what it means. */
export default function AssessmentSummary({ assessment: a }: { assessment: Assessment }) {
  const facts = a.facts.facts;
  const unverifiedQuotes = new Set(a.verification.unverified_quotes);
  const quotesFound = facts.filter((f) => !unverifiedQuotes.has(f.source.quote)).length;
  const quotesMissing = facts.length - quotesFound;
  const sources = new Set(facts.map((f) => f.source.document_id)).size;
  const issues = a.facts.legal_issues;
  const citationsBad = issues.filter((i) => a.verification.unverified_citations.includes(i.provision_id)).length;
  const elements = a.readiness.elements;
  const supported = elements.filter((e) => e.status === "supported").length;

  return (
    <section aria-label="Assessment summary" className="@container overflow-hidden rounded-lg border">
      <div className="grid grid-cols-2 gap-px bg-line @xl:grid-cols-4">
        <Metric label="Elements supported" value={`${supported} of ${elements.length}`}>
          <span className="flex gap-1" aria-hidden>
            {elements.map((e) => (
              <span
                key={e.element}
                className={`h-1.5 flex-1 rounded-full ${DOT[e.status]}`}
                title={`${ELEMENT_LABELS[e.element]}: ${e.status}`}
              />
            ))}
          </span>
        </Metric>

        <Metric label="Facts extracted" value={facts.length}>
          <span className="text-ink-soft">
            from {sources} {sources === 1 ? "source" : "sources"}
          </span>
        </Metric>

        <Metric label="Quotes found in source" value={`${quotesFound} of ${facts.length}`}>
          <Status ok={quotesMissing === 0}>
            {facts.length === 0 ? "No facts yet" : quotesMissing === 0 ? "All found" : `${quotesMissing} not found`}
          </Status>
        </Metric>

        <Metric label="Citations verified" value={`${issues.length - citationsBad} of ${issues.length}`}>
          <Status ok={citationsBad === 0}>
            {issues.length === 0 ? "None cited" : citationsBad === 0 ? "All match the statute" : `${citationsBad} don't match`}
          </Status>
        </Metric>
      </div>
    </section>
  );
}
