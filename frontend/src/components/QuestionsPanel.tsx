"use client";

import { Check, ClipboardCopy, MessageCircleQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, Pill } from "@/components/ui";

const storageKey = (assessmentId: number) => `caseiq:questions:${assessmentId}`;

/**
 * Follow-up questions as a checklist. Ticks are a personal working aid, so they're kept in
 * this browser only, per assessment; they aren't part of the review record.
 */
export default function QuestionsPanel({
  assessmentId,
  questions,
}: {
  assessmentId: number;
  questions: string[];
}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(assessmentId)) ?? "[]");
      setDone(new Set(Array.isArray(saved) ? saved : []));
    } catch {
      setDone(new Set());
    }
  }, [assessmentId]);

  function toggle(i: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      try {
        localStorage.setItem(storageKey(assessmentId), JSON.stringify([...next]));
      } catch {
        // Storage unavailable (private window): ticks just won't persist.
      }
      return next;
    });
  }

  async function copyAll() {
    const open = questions.filter((_, i) => !done.has(i));
    const text = (open.length ? open : questions).map((q, n) => `${n + 1}. ${q}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; nothing else to do.
    }
  }

  const remaining = questions.length - done.size;

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          Questions for the solicitor
          <Pill tone={remaining ? "warn" : "ok"}>{remaining ? `${remaining} open` : "All resolved"}</Pill>
        </span>
      }
      action={
        <button
          type="button"
          onClick={copyAll}
          aria-label={remaining && done.size ? "Copy open questions" : "Copy questions"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm whitespace-nowrap text-ink-soft hover:bg-canvas hover:text-ink"
        >
          {copied ? <Check size={15} className="text-ok" aria-hidden /> : <ClipboardCopy size={15} aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      }
    >
      <p className="mb-3 flex items-start gap-2 text-sm text-ink-soft">
        <MessageCircleQuestion size={16} className="mt-0.5 shrink-0" aria-hidden />
        Things to confirm with the client before relying on this assessment. Tick each one off as you
        resolve it.
      </p>
      <ul aria-label="Questions for the solicitor" className="divide-y divide-line-soft rounded-md border">
        {questions.map((q, i) => {
          const checked = done.has(i);
          return (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-canvas/60 has-[:focus-visible]:bg-canvas">
                <input type="checkbox" checked={checked} onChange={() => toggle(i)} className="peer sr-only" />
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 ${
                    checked ? "border-ok bg-ok text-white" : "border-ink-faint bg-white"
                  }`}
                >
                  {checked && <Check size={13} strokeWidth={3} />}
                </span>
                <span className={`min-w-0 flex-1 text-sm leading-relaxed ${checked ? "text-ink-faint line-through" : ""}`}>
                  {q}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">Ticks are saved in this browser only.</p>
    </Card>
  );
}
