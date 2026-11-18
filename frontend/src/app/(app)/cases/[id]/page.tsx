"use client";

import {
  CircleAlert,
  CircleCheck,
  Download,
  FileCheck2,
  Gauge,
  ListChecks,
  Play,
  ShieldCheck,
} from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import LegislationPanel from "@/components/LegislationPanel";
import QuestionsPanel from "@/components/QuestionsPanel";
import ReviewPanel from "@/components/ReviewPanel";
import { btn, Card, caseStatus, Pill, StatCard, type Tone } from "@/components/ui";
import { api, ELEMENT_LABELS, reportUrl, type Assessment, type Case } from "@/lib/api";

const ELEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  supported: { label: "Supported", tone: "ok" },
  weak: { label: "Weak", tone: "warn" },
  missing: { label: "Missing", tone: "bad" },
};

const REVIEW_STATUS: Record<Assessment["review_status"], { label: string; tone: Tone }> = {
  pending: { label: "Draft: not yet reviewed", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  amended: { label: "Approved with amendments", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
};

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function limitationExpiry(breach: string) {
  const d = new Date(breach);
  d.setFullYear(d.getFullYear() + 6);
  return longDate(d.toISOString());
}

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
      setError(e instanceof Error ? e.message : "Couldn't load the case");
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

  if (!c) return <p className="text-ink-soft">{error ?? "Loading…"}</p>;
  const latest = assessments.at(-1);
  const status = caseStatus(c.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
            <Pill tone={status.tone}>{status.label}</Pill>
          </div>
          <p className="mt-1 text-ink-soft">
            {c.client_name} v {c.counterparty}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {latest && (
            <a href={reportUrl(caseId, latest.id)} className={btn.secondary}>
              <Download size={16} aria-hidden />
              Download PDF report
            </a>
          )}
          <button
            onClick={() => run("assess", () => api.runAssessment(caseId))}
            disabled={!!busy}
            className={btn.primary}
          >
            <Play size={15} aria-hidden />
            {busy === "assess" ? "Analysing…" : latest ? "Run assessment again" : "Run assessment"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-bad/30 bg-bad-tint px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Case details">
            <dl className="space-y-3 text-sm">
              <Detail label="Client" value={c.client_name} />
              <Detail label="Counterparty" value={c.counterparty} />
              <Detail label="Date of alleged breach" value={c.breach_date ? longDate(c.breach_date) : "Unknown"} />
              {c.breach_date && (
                <Detail label="Limitation period ends" value={limitationExpiry(c.breach_date)} />
              )}
              <Detail label="Opened" value={longDate(c.created_at)} />
            </dl>
          </Card>

          <Card title="Client's account">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.description}</p>
          </Card>

          <Card title="Documents" action={<span className="text-xs text-ink-soft">{c.documents.length}</span>}>
            <ul aria-label="Documents" className="mb-4 divide-y divide-line-soft text-sm">
              {c.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 first:pt-0">
                  <FileBadge filename={d.filename} />
                  <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                  <span className="text-xs text-ink-faint">
                    {d.page_count} {d.page_count === 1 ? "page" : "pages"}
                  </span>
                </li>
              ))}
              {c.documents.length === 0 && <li className="pb-1 text-ink-soft">None uploaded yet.</li>}
            </ul>
            <DocumentUpload
              caseId={caseId}
              disabled={!!busy && busy !== "upload"}
              onUploaded={load}
              onBusyChange={(b) => setBusy(b ? "upload" : null)}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {latest ? (
            <AssessmentView
              assessment={latest}
              caseDocs={c.documents}
              busy={!!busy}
              onReview={(decision, note) => run("review", () => api.review(caseId, latest.id, decision, note))}
            />
          ) : (
            <div className="rounded-lg border border-dashed bg-white px-6 py-14 text-center">
              <Gauge size={28} className="mx-auto text-ink-faint" aria-hidden />
              <p className="mt-3 font-medium">No assessment yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                Upload the documents, then run the assessment to extract facts and check the
                evidence for each element of the claim.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileBadge({ filename }: { filename: string }) {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE";
  const tone = ext === "PDF" ? "bg-bad-tint text-bad" : ext === "EML" ? "bg-brand-tint text-brand" : "bg-line-soft text-ink-soft";
  return (
    <span className={`grid h-7 w-9 shrink-0 place-items-center rounded text-[10px] font-semibold ${tone}`} aria-hidden>
      {ext}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function AssessmentView({
  assessment: a,
  caseDocs,
  busy,
  onReview,
}: {
  assessment: Assessment;
  caseDocs: Case["documents"];
  busy: boolean;
  onReview: (decision: string, note: string) => void;
}) {
  const docName = (id: number) =>
    id === 0 ? "Client's account" : (caseDocs.find((d) => d.id === id)?.filename ?? `Document ${id}`);
  const unverified = new Set(a.verification.unverified_quotes);
  const facts = a.facts.facts;
  const verifiedCount = facts.filter((f) => !unverified.has(f.source.quote)).length;
  const supported = a.readiness.elements.filter((e) => e.status === "supported").length;
  const review = REVIEW_STATUS[a.review_status];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <span>
          Assessment {a.id}, run{" "}
          {new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </span>
        <Pill tone={review.tone}>{review.label}</Pill>
      </div>

      {a.model === "stub" && (
        <p className="rounded-md border border-warn/30 bg-warn-tint px-4 py-3 text-sm text-warn">
          <strong className="font-medium">Stub mode:</strong> no AI model was used. Facts are lines of
          the material tagged by keyword, for testing the workflow. Set an Anthropic API key for real
          analysis.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ListChecks} label="Elements supported" value={`${supported} of ${a.readiness.elements.length}`} />
        <StatCard icon={FileCheck2} label="Facts extracted" value={facts.length} />
        <StatCard
          icon={ShieldCheck}
          label="Quotes found in source"
          value={`${verifiedCount} of ${facts.length}`}
        />
      </div>

      <Card
        title="Evidence readiness"
        action={<span className="text-2xl font-semibold tabular-nums">{a.readiness.score}/100</span>}
      >
        <div className="h-2 overflow-hidden rounded-full bg-line-soft" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${a.readiness.score}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          How completely the evidence covers each element of the claim. Not a prediction of outcome.
        </p>
        {!!a.readiness.excluded_facts && (
          <p className="mt-2 text-sm text-bad">
            {a.readiness.excluded_facts} {a.readiness.excluded_facts === 1 ? "fact" : "facts"} left out of
            the score because the quote was not found in the source.
          </p>
        )}

        <ul className="mt-5 divide-y divide-line-soft rounded-md border">
          {a.readiness.elements.map((el) => {
            const s = ELEMENT_STATUS[el.status];
            const Icon = el.status === "supported" ? CircleCheck : CircleAlert;
            return (
              <li key={el.element} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Icon
                  size={17}
                  aria-hidden
                  className={el.status === "supported" ? "text-ok" : el.status === "weak" ? "text-warn" : "text-bad"}
                />
                <span className="flex-1">{ELEMENT_LABELS[el.element]}</span>
                <span className="text-xs text-ink-soft tabular-nums">
                  {el.fact_count} {el.fact_count === 1 ? "fact" : "facts"}
                </span>
                <Pill tone={s.tone}>{s.label}</Pill>
              </li>
            );
          })}
        </ul>

        {a.readiness.flags.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-md bg-warn-tint px-4 py-3 text-sm text-warn">
            {a.readiness.flags.map((f) => (
              <li key={f} className="flex gap-2">
                <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Extracted facts">
        <ul aria-label="Extracted facts" className="-my-1 divide-y divide-line-soft">
          {facts.map((f, i) => {
            const found = !unverified.has(f.source.quote);
            return (
              <li key={i} className="py-4 first:pt-1 last:pb-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{f.statement}</p>
                  <Pill tone="neutral">{ELEMENT_LABELS[f.element]}</Pill>
                </div>
                <blockquote className="mt-2 border-l-2 border-line pl-3 font-serif text-[15px] leading-relaxed">
                  {found ? <mark>{f.source.quote}</mark> : <span>{f.source.quote}</span>}
                </blockquote>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {docName(f.source.document_id)}
                  {!found && <UnverifiedBadge />}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      <LegislationPanel assessment={a} />

      {a.facts.open_questions.length > 0 && (
        <QuestionsPanel assessmentId={a.id} questions={a.facts.open_questions} />
      )}

      <ReviewPanel assessment={a} disabled={busy} onReview={onReview} />
    </>
  );
}

function UnverifiedBadge() {
  return (
    <span className="ml-2 rounded bg-bad-tint px-1.5 py-0.5 text-[11px] font-medium text-bad">
      quote not found in source
    </span>
  );
}
