"use client";

import { CircleCheck, CircleX, FilePen, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { Card, field } from "@/components/ui";
import type { Assessment } from "@/lib/api";

type Decision = "approved" | "amended" | "rejected";

const OPTIONS: Record<
  Decision,
  {
    title: string;
    body: string;
    icon: LucideIcon;
    selected: string;
    iconTone: string;
    submit: string;
    submitClass: string;
    noteHint: string;
    noteRequired: boolean;
  }
> = {
  approved: {
    title: "Approve",
    body: "The assessment is accurate as it stands.",
    icon: CircleCheck,
    selected: "border-ok bg-ok-tint/60 ring-1 ring-ok",
    iconTone: "text-ok",
    submit: "Approve",
    submitClass: "bg-brand text-white hover:bg-brand-hover",
    noteHint: "Optional.",
    noteRequired: false,
  },
  amended: {
    title: "Approve with amendments",
    body: "Broadly right, with corrections you note below.",
    icon: FilePen,
    selected: "border-warn bg-warn-tint/60 ring-1 ring-warn",
    iconTone: "text-warn",
    submit: "Approve with amendments",
    submitClass: "bg-brand text-white hover:bg-brand-hover",
    noteHint: "Required. Say what needs correcting.",
    noteRequired: true,
  },
  rejected: {
    title: "Reject",
    body: "Not reliable enough to use. Say why below.",
    icon: CircleX,
    selected: "border-bad bg-bad-tint/60 ring-1 ring-bad",
    iconTone: "text-bad",
    submit: "Reject assessment",
    submitClass: "bg-bad text-white hover:bg-bad/90",
    noteHint: "Required. Say why it can't be relied on.",
    noteRequired: true,
  },
};

const LABELS: Record<Assessment["review_status"], string> = {
  pending: "Not yet reviewed",
  approved: "Approved",
  amended: "Approved with amendments",
  rejected: "Rejected",
};

export default function ReviewPanel({
  assessment,
  disabled,
  onReview,
}: {
  assessment: Assessment;
  disabled: boolean;
  onReview: (decision: string, note: string) => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  if (assessment.review_status !== "pending") {
    const done = OPTIONS[assessment.review_status];
    const Icon = done.icon;
    return (
      <Card title="Solicitor review">
        <div className="flex items-start gap-3">
          <Icon size={22} className={`mt-0.5 shrink-0 ${done.iconTone}`} aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{LABELS[assessment.review_status]}</p>
            {assessment.reviewed_at && (
              <p className="text-sm text-ink-soft">
                Recorded{" "}
                {new Date(assessment.reviewed_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
              </p>
            )}
            {assessment.reviewer_note && (
              <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed">
                “{assessment.reviewer_note}”
              </blockquote>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              A review can&apos;t be changed. Run the assessment again to start a new one.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const chosen = decision ? OPTIONS[decision] : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) return setError("Choose a decision first.");
    if (OPTIONS[decision].noteRequired && !note.trim())
      return setError(decision === "rejected" ? "Add a note saying why you're rejecting it." : "Add a note saying what needs correcting.");
    setError(null);
    onReview(decision, note.trim());
  }

  return (
    <Card title="Solicitor review">
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend className="text-sm text-ink-soft">
            This assessment is a draft until you record a decision.
          </legend>
          <div className="mt-4 grid gap-2">
            {(Object.keys(OPTIONS) as Decision[]).map((d) => {
              const o = OPTIONS[d];
              const Icon = o.icon;
              const on = decision === d;
              return (
                <label
                  key={d}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30 ${
                    on ? o.selected : "bg-white hover:border-ink-faint"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-decision`}
                    value={d}
                    checked={on}
                    onChange={() => {
                      setDecision(d);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  <Icon size={20} className={`mt-0.5 shrink-0 ${o.iconTone}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{o.title}</span>
                    <span className="block text-xs leading-relaxed text-ink-soft">{o.body}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-ink" : "border-ink-faint"}`}
                  >
                    {on && <span className="size-2 rounded-full bg-ink" />}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Review note
          </label>
          <p id={`${id}-hint`} className="mt-0.5 text-xs text-ink-soft">
            {chosen?.noteHint ?? "Required if you amend or reject."}
          </p>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
            aria-describedby={`${id}-hint`}
            rows={3}
            placeholder="Causation needs client instructions on how the slabs were stored."
            className={`${field} mt-1.5`}
          />
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 border-t border-line-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-soft">
            Your decision and note are recorded with the time and printed on the PDF report.
          </p>
          <button
            disabled={disabled}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              chosen ? chosen.submitClass : "bg-brand text-white hover:bg-brand-hover"
            }`}
          >
            {chosen ? chosen.submit : "Record decision"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
