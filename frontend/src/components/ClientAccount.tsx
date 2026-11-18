"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import type { Assessment } from "@/lib/api";
import { withHighlights } from "@/lib/highlight";

/** Facts cite the client's account as document 0. */
const CLIENT_ACCOUNT_ID = 0;

export default function ClientAccount({ description, assessment }: { description: string; assessment?: Assessment }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const unverified = new Set(assessment?.verification.unverified_quotes ?? []);
  const citing = (assessment?.facts.facts ?? []).filter((f) => f.source.document_id === CLIENT_ACCOUNT_ID);
  const quotes = citing.map((f) => f.source.quote).filter((q) => !unverified.has(q));

  // Only offer "Read more" when the clamped text is actually cut off.
  useLayoutEffect(() => {
    const el = body.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [description, expanded]);

  return (
    <Card
      title="Client's account"
      action={
        assessment && (
          <span className={`text-xs ${citing.length ? "text-brand" : "text-ink-soft"}`}>
            {citing.length ? `${citing.length} ${citing.length === 1 ? "fact" : "facts"}` : "no facts"}
          </span>
        )
      }
    >
      <p className="mb-2 text-xs text-ink-soft">In the client&apos;s own words, as given at intake.</p>
      <div
        ref={body}
        className={`border-l-2 border-line pl-3 font-serif text-[15px] leading-relaxed whitespace-pre-wrap ${
          expanded ? "" : "line-clamp-6"
        }`}
      >
        {withHighlights(description, quotes)}
      </div>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          {expanded ? "Show less" : "Read more"}
          {expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
        </button>
      )}
      {quotes.length > 0 && (
        <p className="mt-3 text-xs text-ink-faint">Highlighted passages are quoted by extracted facts.</p>
      )}
    </Card>
  );
}
