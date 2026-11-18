"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";

// What the backend does on each run, in order. Listed, not animated as fake progress:
// the API returns once at the end, so the page can't know which step is current.
const STEPS = [
  "Reading the documents and the client's account",
  "Extracting facts, each with a quote from its source",
  "Finding relevant legislation",
  "Checking every quote and citation against its source",
  "Scoring evidence readiness and the limitation period",
];

export default function AssessmentProgress() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section role="status" aria-live="polite" className="rounded-lg border border-brand/30 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 font-medium text-brand">
          <Spinner className="size-4" />
          Running the assessment
        </p>
        <span className="text-sm text-ink-soft tabular-nums" aria-hidden>
          {seconds}s
        </span>
      </div>
      <ol className="mt-4 space-y-2 text-sm text-ink-soft">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-faint">With the AI model this can take up to a minute. Keep this page open.</p>
    </section>
  );
}
