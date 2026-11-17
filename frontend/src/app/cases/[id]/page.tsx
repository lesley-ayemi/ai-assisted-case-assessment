"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, ELEMENT_LABELS, reportUrl, type Assessment, type Case } from "@/lib/api";

const STATUS_STYLES = {
  supported: "bg-emerald-100 text-emerald-800",
  weak: "bg-amber-100 text-amber-800",
  missing: "bg-red-100 text-red-800",
} as const;

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const caseId = Number(use(params).id);
  const [c, setCase] = useState<Case | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cs, as] = await Promise.all([api.getCase(caseId), api.listAssessments(caseId)]);
      setCase(cs);
      setAssessments(as);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (!c) return <p className="text-slate-500">{error ?? "Loading…"}</p>;
  const latest = assessments.at(-1);
  const docName = (id: number) =>
    id === 0 ? "Client description" : (c.documents.find((d) => d.id === id)?.filename ?? `#${id}`);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-sm text-slate-500">
          {c.client_name} v {c.counterparty}
          {c.breach_date && ` · breach ${c.breach_date}`}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm">{c.description}</p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-medium">Documents</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {c.documents.map((d) => (
            <li key={d.id}>
              {d.filename} <span className="text-slate-400">· {d.page_count} page(s)</span>
            </li>
          ))}
          {c.documents.length === 0 && <li className="text-slate-500">None uploaded yet.</li>}
        </ul>
        <input
          type="file"
          accept=".pdf,.txt,.md,.eml"
          disabled={!!busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run("upload", () => api.uploadDocument(caseId, file));
            e.target.value = "";
          }}
          className="text-sm"
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={() => run("assess", () => api.runAssessment(caseId))}
          disabled={!!busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === "assess" ? "Analysing…" : "Run assessment"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {latest && (
        <section className="space-y-6 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <p className="text-xs text-slate-500">
              Assessment #{latest.id} · {new Date(latest.created_at).toLocaleString()} ·{" "}
              <span className="capitalize">{latest.review_status}</span>
            </p>
            <a
              href={reportUrl(caseId, latest.id)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Download PDF report
            </a>
          </div>
          {latest.model === "stub" && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Stub mode:</strong> no AI model was used. Facts are lines of the material
              tagged by keyword, for testing the workflow. Set an Anthropic API key for real
              analysis.
            </p>
          )}
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Evidence readiness</h2>
            <span className="text-3xl font-semibold">{latest.readiness.score}/100</span>
          </div>
          <p className="text-xs text-slate-500">
            How completely the evidence covers each element of the claim. Not a prediction of
            outcome.
          </p>
          {!!latest.readiness.excluded_facts && (
            <p className="text-xs text-red-700">
              {latest.readiness.excluded_facts} fact(s) left out of the score because the quote
              was not found in the source.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            {latest.readiness.elements.map((el) => (
              <div key={el.element} className="rounded-md border p-3">
                <p className="text-sm font-medium">{ELEMENT_LABELS[el.element]}</p>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${STATUS_STYLES[el.status]}`}>
                  {el.status} · {el.fact_count} fact(s)
                </span>
              </div>
            ))}
          </div>

          {latest.readiness.flags.length > 0 && (
            <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              {latest.readiness.flags.map((f) => (
                <li key={f}>⚠ {f}</li>
              ))}
            </ul>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium">Extracted facts</h3>
            <ul className="space-y-2 text-sm">
              {latest.facts.facts.map((f, i) => (
                <li key={i} className="rounded-md border p-3">
                  <p>{f.statement}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ELEMENT_LABELS[f.element]} · {docName(f.source.document_id)}: “{f.source.quote}”
                    {latest.verification.unverified_quotes.includes(f.source.quote) && (
                      <UnverifiedBadge />
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <LegislationPanel assessment={latest} />

          <div>
            <h3 className="mb-2 text-sm font-medium">Questions for the solicitor</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {latest.facts.open_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>

          <ReviewPanel
            assessment={latest}
            disabled={!!busy}
            onReview={(decision, note) =>
              run("review", () => api.review(caseId, latest.id, decision, note))
            }
          />
        </section>
      )}
    </div>
  );
}

function UnverifiedBadge() {
  return (
    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
      quote not found in source
    </span>
  );
}

function LegislationPanel({ assessment }: { assessment: Assessment }) {
  const { legal_issues } = assessment.facts;
  const { unverified_citations } = assessment.verification;
  const byId = new Map(assessment.sources.map((s) => [s.id, s]));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Relevant legislation</h3>
      {legal_issues.length === 0 && (
        <p className="text-sm text-slate-500">No retrieved provision was judged relevant.</p>
      )}
      <ul className="space-y-2 text-sm">
        {legal_issues.map((issue, i) => {
          const source = byId.get(issue.provision_id);
          const verified = !unverified_citations.includes(issue.provision_id);
          return (
            <li key={i} className="rounded-md border p-3">
              <p>{issue.issue}</p>
              <p className="mt-1 text-xs text-slate-500">
                {source ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                    {source.citation}
                  </a>
                ) : (
                  issue.provision_id
                )}
                : “{issue.quote}”
                {verified ? (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                    verified against statute text
                  </span>
                ) : (
                  <UnverifiedBadge />
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">Provisions considered ({assessment.sources.length})</summary>
        <ul className="mt-2 space-y-1">
          {assessment.sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                {s.citation}
              </a>{" "}
              {s.title} ·{" "}
              {s.via === "rule" ? "applied by the limitation check" : `search score ${s.score}`}
            </li>
          ))}
        </ul>
        <p className="mt-2">Source: legislation.gov.uk, Open Government Licence v3.0.</p>
      </details>
    </div>
  );
}

function ReviewPanel({
  assessment,
  disabled,
  onReview,
}: {
  assessment: Assessment;
  disabled: boolean;
  onReview: (decision: string, note: string) => void;
}) {
  const [note, setNote] = useState("");

  if (assessment.review_status !== "pending") {
    return (
      <div className="rounded-md bg-slate-50 p-3 text-sm">
        <strong className="capitalize">{assessment.review_status}</strong>
        {assessment.reviewed_at && ` on ${new Date(assessment.reviewed_at).toLocaleString()}`}
        {assessment.reviewer_note && <p className="mt-1">“{assessment.reviewer_note}”</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-sm font-medium">Solicitor review</h3>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Review note (optional)"
        rows={2}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        {(["approved", "amended", "rejected"] as const).map((d) => (
          <button
            key={d}
            disabled={disabled}
            onClick={() => onReview(d, note)}
            className="rounded-md border px-3 py-1.5 text-sm capitalize hover:bg-slate-50 disabled:opacity-50"
          >
            {d === "approved" ? "Approve" : d === "amended" ? "Approve with amendments" : "Reject"}
          </button>
        ))}
      </div>
    </div>
  );
}
