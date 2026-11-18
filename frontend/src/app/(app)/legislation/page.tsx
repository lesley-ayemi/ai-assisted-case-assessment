"use client";

import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";
import { btn, field } from "@/components/ui";
import { api, type ProvisionHit } from "@/lib/api";

const EXAMPLES = [
  "the goods arrived cracked and we rejected them",
  "customer has not paid our invoice",
  "the contract caps their liability at the fees paid",
  "work done at our usual rates but no price agreed",
];

const ACTS = [
  "Limitation Act 1980",
  "Sale of Goods Act 1979",
  "Supply of Goods and Services Act 1982",
  "Late Payment of Commercial Debts (Interest) Act 1998",
  "Unfair Contract Terms Act 1977",
  "Misrepresentation Act 1967",
  "Contracts (Rights of Third Parties) Act 1999",
];

export default function LegislationSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const initial = use(searchParams).q ?? "";
  const [query, setQuery] = useState(initial);
  const [hits, setHits] = useState<ProvisionHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    setError(null);
    setOpen(null);
    try {
      setHits(await api.searchLegislation(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  }, []);

  useEffect(() => {
    if (initial.trim().length >= 2) search(initial);
  }, [initial, search]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Legislation search</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Describe the problem in plain words. Everyday terms like &ldquo;cracked&rdquo; are matched to
            statutory language like &ldquo;satisfactory quality&rdquo;.
          </p>
        </div>

        <section className="rounded-lg border bg-white p-5">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 2) search(query);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <label className="relative flex-1">
              <span className="sr-only">Describe the problem</span>
              <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Supplier delivered faulty goods"
                className={`${field} pl-9`}
              />
            </label>
            <button className={btn.primary}>Search</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => search(ex)}
                className="rounded-full border bg-white px-3 py-1 text-xs text-ink-soft hover:border-brand hover:text-brand"
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        {hits?.length === 0 && (
          <p className="text-sm text-ink-soft">No matching provisions. Try describing it another way.</p>
        )}

        {hits && hits.length > 0 && (
          <section className="overflow-hidden rounded-lg border bg-white">
            <div className="border-b border-line-soft px-5 py-3.5 text-sm text-ink-soft">
              {hits.length} provisions, best match first
            </div>
            <ul className="divide-y divide-line-soft">
              {hits.map((h) => {
                const expanded = open === h.id;
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => setOpen(expanded ? null : h.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-canvas/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{h.citation}</span>
                        <span className="block text-sm text-ink-soft">{h.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint tabular-nums">score {h.score}</span>
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className={`shrink-0 text-ink-faint transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expanded && (
                      <div className="px-5 pb-5">
                        <p className="max-w-[68ch] font-serif text-[15px] leading-relaxed whitespace-pre-wrap">
                          {h.text}
                        </p>
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand underline underline-offset-2"
                        >
                          View on legislation.gov.uk
                          <ExternalLink size={13} aria-hidden />
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <aside className="rounded-lg border bg-white p-5 text-sm">
        <h2 className="font-medium">Acts covered</h2>
        <p className="mt-1 text-xs text-ink-soft">57 sections relevant to contract disputes</p>
        <ul className="mt-3 space-y-2 text-ink-soft">
          {ACTS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line-soft pt-3 text-xs text-ink-faint">
          Contains public sector information licensed under the Open Government Licence v3.0.
        </p>
      </aside>
    </div>
  );
}
