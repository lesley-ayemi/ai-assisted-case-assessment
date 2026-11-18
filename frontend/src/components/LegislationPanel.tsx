"use client";

import { ChevronDown, CircleAlert, ExternalLink, Scale, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { TextSkeleton } from "@/components/Skeletons";
import { Card, Pill } from "@/components/ui";
import { api, type Assessment, type LegalIssue, type Provision, type ProvisionRef } from "@/lib/api";

/** "Sale of Goods Act 1979, s.14" -> { act: "Sale of Goods Act 1979", section: "14" } */
function splitCitation(citation: string) {
  const m = citation.match(/^(.*), s\.(.+)$/);
  return m ? { act: m[1], section: m[2] } : { act: citation, section: "" };
}

/** Wraps the quoted words in the full text with <mark>, tolerating line breaks and spacing. */
function Highlighted({ text, quote }: { text: string; quote: string }) {
  const words = quote.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = words.length ? text.match(new RegExp(words.join("\\s+"))) : null;
  if (!match || match.index === undefined) return <>{text}</>;
  const end = match.index + match[0].length;
  return (
    <>
      {text.slice(0, match.index)}
      <mark>{match[0]}</mark>
      {text.slice(end)}
    </>
  );
}

/** Scrolls the highlighted quote to the top of the section text when it first renders. */
function scrollToMark(el: HTMLParagraphElement | null) {
  const mark = el?.querySelector("mark");
  if (el && mark) el.scrollTop = Math.max(0, mark.offsetTop - el.offsetTop - 8);
}

function IssueRow({ issue, source, verified }: { issue: LegalIssue; source?: ProvisionRef; verified: boolean }) {
  const [open, setOpen] = useState(false);
  const [provision, setProvision] = useState<Provision | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { act, section } = splitCitation(source?.citation ?? issue.provision_id);

  async function toggle() {
    setOpen((o) => !o);
    if (!provision && !loadError) {
      try {
        setProvision(await api.getProvision(issue.provision_id));
      } catch {
        setLoadError(true);
      }
    }
  }

  return (
    <li className="grid gap-3 py-5 first:pt-1 last:pb-1 @lg:grid-cols-[120px_minmax(0,1fr)] @lg:gap-5">
      <div>
        {source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            aria-label={source.citation}
            className="group block"
          >
            {section && <span className="block text-xl font-semibold text-brand group-hover:underline">s.{section}</span>}
            <span className="block text-xs leading-snug text-ink-soft">{act}</span>
          </a>
        ) : (
          <span className="block text-sm font-medium">{issue.provision_id}</span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm leading-relaxed">{issue.issue}</p>
        <blockquote className="mt-2.5 font-serif text-[15px] leading-relaxed">
          {verified ? <mark>{issue.quote}</mark> : <span className="text-ink-soft">{issue.quote}</span>}
        </blockquote>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {verified ? (
            <span className="inline-flex items-center gap-1 font-medium text-ok">
              <ShieldCheck size={14} aria-hidden />
              verified against statute text
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-bad-tint px-1.5 py-0.5 font-medium text-bad">
              <CircleAlert size={13} aria-hidden />
              quote not found in source
            </span>
          )}
          {source && (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"
            >
              {open ? "Hide section" : `Read section ${section || "text"}`}
              <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {open && (
          <div className="mt-3 rounded-md border bg-canvas/50 px-4 py-3">
            {provision ? (
              <>
                <p className="text-xs font-medium text-ink-soft">{provision.title}</p>
                <p
                  ref={scrollToMark}
                  className="mt-2 max-h-80 max-w-[68ch] overflow-y-auto pr-2 font-serif text-[15px] leading-relaxed whitespace-pre-wrap"
                >
                  <Highlighted text={provision.text} quote={issue.quote} />
                </p>
                <a
                  href={provision.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand underline underline-offset-2"
                >
                  View on legislation.gov.uk
                  <ExternalLink size={12} aria-hidden />
                </a>
              </>
            ) : (
              loadError ? (
              <p className="text-sm text-ink-soft">Couldn&apos;t load the section text.</p>
            ) : (
              <TextSkeleton lines={5} label="Loading section text" />
            )
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function LegislationPanel({ assessment }: { assessment: Assessment }) {
  const { legal_issues } = assessment.facts;
  const { unverified_citations } = assessment.verification;
  const byId = new Map(assessment.sources.map((s) => [s.id, s]));
  const cited = new Set(legal_issues.map((i) => i.provision_id));
  const maxScore = Math.max(1, ...assessment.sources.map((s) => s.score ?? 0));

  return (
    <Card
      title="Relevant legislation"
      action={<span className="text-xs text-ink-soft">{legal_issues.length} cited</span>}
    >
      {legal_issues.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Scale size={16} aria-hidden />
          No retrieved provision was judged relevant.
        </p>
      ) : (
        <ul className="@container divide-y divide-line-soft">
          {legal_issues.map((issue, i) => (
            <IssueRow
              key={i}
              issue={issue}
              source={byId.get(issue.provision_id)}
              verified={!unverified_citations.includes(issue.provision_id)}
            />
          ))}
        </ul>
      )}

      <details className="group @container mt-5 rounded-md border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-medium">Provisions considered ({assessment.sources.length})</span>
            <span className="ml-2 hidden text-ink-soft @md:inline">Everything the search found, and rules applied</span>
          </span>
          <ChevronDown size={16} aria-hidden className="text-ink-faint transition-transform group-open:rotate-180" />
        </summary>
        <ul className="@container divide-y divide-line-soft border-t border-line-soft text-sm">
          {assessment.sources.map((s) => (
            <li key={s.id} className="grid gap-1 px-4 py-2.5 @lg:grid-cols-[minmax(0,1fr)_170px] @lg:items-center @lg:gap-4">
              <div className="min-w-0">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                  {s.citation}
                </a>
                <span className="text-ink-soft"> {s.title}</span>
                {cited.has(s.id) && (
                  <span className="ml-2">
                    <Pill tone="brand">Cited</Pill>
                  </span>
                )}
              </div>
              {s.via === "rule" ? (
                <span className="text-xs text-ink-soft">applied by the limitation check</span>
              ) : (
                <span className="flex items-center gap-2 text-xs text-ink-soft" title={`Search score ${s.score}`}>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-brand/60"
                      style={{ width: `${Math.round(((s.score ?? 0) / maxScore) * 100)}%` }}
                    />
                  </span>
                  <span className="w-16 tabular-nums">score {Math.round((s.score ?? 0) * 10) / 10}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line-soft px-4 py-2.5 text-xs text-ink-faint">
          Source: legislation.gov.uk, Open Government Licence v3.0. Search scores are relative: higher means a closer
          keyword match to this case.
        </p>
      </details>
    </Card>
  );
}
