"use client";

import { ChevronDown, ExternalLink, Search, Sparkles, X } from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";
import { ResultsSkeleton } from "@/components/Skeletons";
import { btn, field, Pill, Spinner } from "@/components/ui";
import { api, type LegislationStats, type ProvisionHit, type QueryExpansion } from "@/lib/api";

const EXAMPLES = [
  "the goods arrived cracked and we rejected them",
  "customer has not paid our invoice",
  "the contract caps their liability at the fees paid",
  "work done at our usual rates but no price agreed",
];

const actOf = (citation: string) => citation.replace(/, s\..*$/, "");

/** Marks whole words that start with any matched stem ("fit" marks "fitness"). */
function markMatches(text: string, stems: string[]) {
  const usable = stems.filter((s) => s.length >= 3).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!usable.length) return [text];
  const re = new RegExp(`\\b((?:${usable.join("|")})\\w*)`, "gi");
  // Green tint, not the yellow highlighter: yellow means "quoted verbatim from a source".
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-brand-tint font-medium text-brand">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** A short extract centred on the first matching word. */
function snippet(text: string, stems: string[], length = 240) {
  const flat = text.replace(/\s+/g, " ").trim();
  const usable = stems.filter((s) => s.length >= 3);
  const first = usable.length ? flat.search(new RegExp(`\\b(${usable.join("|")})`, "i")) : -1;
  const start = Math.max(0, (first < 0 ? 0 : first) - 80);
  let out = flat.slice(start, start + length);
  if (start > 0) out = "…" + out.slice(out.indexOf(" ") + 1);
  if (start + length < flat.length) out = out.slice(0, out.lastIndexOf(" ")) + "…";
  return out;
}

function Result({ hit, best, topScore }: { hit: ProvisionHit; best: boolean; topScore: number }) {
  const [open, setOpen] = useState(false);
  const relevance = Math.round((hit.score / topScore) * 100);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{hit.citation}</span>
            {best && <Pill tone="brand">Best match</Pill>}
          </p>
          <p className="text-sm text-ink-soft">{hit.title}</p>
        </div>
        <span className="flex w-36 items-center gap-2 text-xs text-ink-soft" title={`Search score ${hit.score}`}>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft" aria-hidden>
            <span className="block h-full rounded-full bg-brand/70" style={{ width: `${relevance}%` }} />
          </span>
          <span className="tabular-nums">{relevance}%</span>
        </span>
      </div>

      <p className="mt-2.5 max-w-[72ch] font-serif text-[15px] leading-relaxed whitespace-pre-wrap">
        {markMatches(open ? hit.text : snippet(hit.text, hit.matched), hit.matched)}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-ink-soft hover:text-ink"
        >
          {open ? "Show extract" : "Read full section"}
          <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <a
          href={hit.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-brand underline underline-offset-2"
        >
          legislation.gov.uk
          <ExternalLink size={13} aria-hidden />
        </a>
      </div>
    </li>
  );
}

export default function LegislationSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const initial = use(searchParams).q ?? "";
  const [query, setQuery] = useState(initial);
  const [searched, setSearched] = useState("");
  const [hits, setHits] = useState<ProvisionHit[] | null>(null);
  const [expansion, setExpansion] = useState<QueryExpansion[]>([]);
  const [stats, setStats] = useState<LegislationStats | null>(null);
  const [act, setAct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    setError(null);
    setAct(null);
    setSearching(true);
    try {
      const [h, x] = await Promise.all([api.searchLegislation(q, 10), api.expandQuery(q)]);
      setHits(h);
      setExpansion(x);
      setSearched(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    api.legislationStats().then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (initial.trim().length >= 2) search(initial);
  }, [initial, search]);

  const actCounts = new Map<string, number>();
  for (const h of hits ?? []) actCounts.set(actOf(h.citation), (actCounts.get(actOf(h.citation)) ?? 0) + 1);
  const shown = (hits ?? []).filter((h) => !act || actOf(h.citation) === act);
  const topScore = Math.max(...(hits ?? []).map((h) => h.score), 1e-9);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Legislation search</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Describe the problem in plain words. Everyday terms are matched to statutory language, so
          &ldquo;cracked&rdquo; also finds &ldquo;satisfactory quality&rdquo;.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim().length >= 2) search(query.trim());
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label className="relative flex-1">
            <span className="sr-only">Describe the problem</span>
            <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Supplier delivered faulty goods"
              className={`${field} h-11 pr-10 pl-11 text-base`}
            />
            {query && (
              <button
                type="button"
                onClick={(e) => {
                  setQuery("");
                  e.currentTarget.parentElement?.querySelector("input")?.focus();
                }}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded text-ink-faint hover:bg-line-soft hover:text-ink"
              >
                <X size={15} aria-hidden />
              </button>
            )}
          </label>
          <button disabled={searching} className={`${btn.primary} h-11 px-6`}>
            {searching && <Spinner />}
            {searching ? "Searching…" : "Search"}
          </button>
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

        {expansion.length > 0 && (
          <div className="mt-4 flex gap-2.5 rounded-md bg-brand-tint px-3.5 py-2.5 text-sm text-brand">
            <Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Also searched for statutory terms</p>
              <ul className="mt-1 space-y-0.5">
                {expansion.map((x) => (
                  <li key={x.matched}>
                    &ldquo;{x.matched}&rdquo; added <span className="font-medium">{x.terms}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {searching ? (
            <ResultsSkeleton />
          ) : hits === null ? (
            <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center text-sm text-ink-soft">
              Search results appear here, best match first, with the matching words highlighted.
            </div>
          ) : hits.length === 0 ? (
            <p className="rounded-lg border bg-white px-5 py-10 text-center text-sm text-ink-soft">
              No matching provisions. Try describing it another way.
            </p>
          ) : (
            <section className="overflow-hidden rounded-lg border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3.5 text-sm">
                <p className="text-ink-soft">
                  <span className="font-medium text-ink">{shown.length}</span>{" "}
                  {shown.length === 1 ? "provision" : "provisions"} for &ldquo;{searched}&rdquo;
                  {act && <> in {act}</>}
                </p>
                {act && (
                  <button type="button" onClick={() => setAct(null)} className="text-ink-soft hover:text-ink">
                    Show all Acts
                  </button>
                )}
              </div>
              <ul className="divide-y divide-line-soft">
                {shown.map((h) => (
                  <Result key={h.id} hit={h} best={h.id === hits[0].id} topScore={topScore} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="rounded-lg border bg-white p-5 text-sm">
          {hits && hits.length > 0 ? (
            <>
              <h2 className="font-medium">Filter by Act</h2>
              <ul className="mt-3 space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => setAct(null)}
                    aria-pressed={!act}
                    className={`flex w-full justify-between rounded-md px-2.5 py-1.5 text-left ${
                      !act ? "bg-brand-tint font-medium text-brand" : "text-ink-soft hover:bg-canvas"
                    }`}
                  >
                    All results <span className="tabular-nums">{hits.length}</span>
                  </button>
                </li>
                {[...actCounts].map(([name, n]) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => setAct(act === name ? null : name)}
                      aria-pressed={act === name}
                      className={`flex w-full justify-between gap-3 rounded-md px-2.5 py-1.5 text-left ${
                        act === name ? "bg-brand-tint font-medium text-brand" : "text-ink-soft hover:bg-canvas"
                      }`}
                    >
                      <span>{name}</span>
                      <span className="tabular-nums">{n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="font-medium">Acts covered</h2>
              <p className="mt-1 text-xs text-ink-soft">
                {stats ? `${stats.provisions} sections` : "Sections"} relevant to contract disputes
              </p>
              <ul className="mt-3 space-y-2 text-ink-soft">
                {(stats?.acts ?? []).map((a) => (
                  <li key={a} className="flex justify-between gap-3">
                    <span>{a}</span>
                    <span className="text-ink-faint tabular-nums">{stats?.sections_per_act[a]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 border-t border-line-soft pt-3 text-xs text-ink-faint">
            Contains public sector information licensed under the Open Government Licence v3.0.
          </p>
        </aside>
      </div>
    </div>
  );
}
