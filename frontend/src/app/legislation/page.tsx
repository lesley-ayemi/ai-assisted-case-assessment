"use client";

import { useState } from "react";
import { api, type ProvisionHit } from "@/lib/api";

const EXAMPLES = [
  "the goods arrived cracked and we rejected them",
  "customer has not paid our invoice",
  "the contract caps their liability at the fees paid",
  "work done at our usual rates but no price agreed",
];

export default function LegislationSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProvisionHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    setError(null);
    try {
      setHits(await api.searchLegislation(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Legislation search</h1>
        <p className="text-sm text-slate-500">
          Keyword search (BM25) over selected provisions from seven Acts relevant to contract
          disputes. Describe the problem in plain words.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) search(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. supplier delivered faulty goods"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => search(ex)}
            className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-slate-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {hits?.length === 0 && <p className="text-sm text-slate-500">No matching provisions.</p>}

      <ul className="space-y-2">
        {hits?.map((h) => (
          <li key={h.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-baseline justify-between gap-4">
              <button onClick={() => setOpen(open === h.id ? null : h.id)} className="text-left">
                <p className="font-medium">{h.citation}</p>
                <p className="text-sm text-slate-500">{h.title}</p>
              </button>
              <span className="shrink-0 text-xs text-slate-400">score {h.score}</span>
            </div>
            {open === h.id && (
              <div className="mt-3 space-y-2">
                <p className="whitespace-pre-wrap text-sm">{h.text}</p>
                <a href={h.url} target="_blank" rel="noreferrer" className="text-xs underline">
                  View on legislation.gov.uk
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-400">
        Contains public sector information licensed under the Open Government Licence v3.0.
      </p>
    </div>
  );
}
