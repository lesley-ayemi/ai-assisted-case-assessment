"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { cloneElement, useId, useState } from "react";
import DateField from "@/components/DateField";
import { btn, field, Spinner } from "@/components/ui";
import { api, type CaseCreate } from "@/lib/api";

// Eval case 04 (evals/cases/04-defective-worktops), so a demo can get to an assessment quickly.
const SAMPLE: CaseCreate = {
  title: "Cracked quartz worktops",
  client_name: "Linden Kitchens Ltd",
  counterparty: "Stoneway Surfaces Ltd",
  breach_date: "2025-09-12",
  description:
    "We ordered 2,000 quartz worktops from Stoneway for a housing development. When they arrived on 12 September 2025 our inspection found about 600 were cracked. We rejected the cracked ones the same week. Stoneway will not replace them, so we have a quote of £18,500 from another supplier to make up the shortfall.",
};

const EMPTY: CaseCreate = { title: "", client_name: "", counterparty: "", breach_date: null, description: "" };

const PROMPTS = [
  "What was agreed, and when",
  "What went wrong, and when it happened",
  "What the client has done about it so far",
  "What it has cost, or will cost",
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const control = cloneElement(children, { id, "aria-describedby": hint ? `${id}-hint` : undefined });
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{control}</div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-x-8 gap-y-4 border-t border-line-soft px-6 py-6 first-of-type:border-t-0 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <legend className="text-sm font-medium">{title}</legend>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">{note}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

export default function NewCase() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<CaseCreate>(EMPTY);
  const [formKey, setFormKey] = useState(0); // remounts the inputs when the sample is loaded
  const [words, setWords] = useState(0);

  const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  function loadSample() {
    setValues(SAMPLE);
    setWords(countWords(SAMPLE.description));
    setFormKey((k) => k + 1);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCase({
        title: String(f.get("title")).trim(),
        client_name: String(f.get("client_name")).trim(),
        counterparty: String(f.get("counterparty")).trim(),
        description: String(f.get("description")).trim(),
        breach_date: (f.get("breach_date") as string) || null,
      });
      router.push(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the case");
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <form key={formKey} onSubmit={onSubmit} className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New case</h1>
            <p className="mt-0.5 text-sm text-ink-soft">You can upload documents on the next screen.</p>
          </div>
          <button type="button" onClick={loadSample} className={btn.secondary}>
            <FileText size={15} aria-hidden />
            Use sample case
          </button>
        </div>

        <Section title="The matter" note="A short name you'll recognise in the case list.">
          <Field label="Title">
            <input name="title" required defaultValue={values.title} className={field} placeholder="Cracked quartz worktops" />
          </Field>
        </Section>

        <Section title="Parties" note="Who you act for, and who the claim is against.">
          <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Field label="Client">
              <input
                name="client_name"
                required
                defaultValue={values.client_name}
                className={field}
                placeholder="Linden Kitchens Ltd"
              />
            </Field>
            <span className="hidden pb-2.5 text-sm text-ink-faint sm:block" aria-hidden>
              v
            </span>
            <Field label="Counterparty">
              <input
                name="counterparty"
                required
                defaultValue={values.counterparty}
                className={field}
                placeholder="Stoneway Surfaces Ltd"
              />
            </Field>
          </div>
        </Section>

        <Section title="The dispute" note="The breach date drives the limitation check. The account is evidence in its own right.">
          <Field label="Date of alleged breach" hint="Used to check the limitation period. Leave blank if unknown.">
            <DateField name="breach_date" defaultValue={values.breach_date ?? undefined} />
          </Field>
          <Field label="What happened?" hint="The client's account, in their own words.">
            <textarea
              name="description"
              required
              rows={8}
              defaultValue={values.description}
              onChange={(e) => setWords(countWords(e.target.value))}
              className={field}
            />
          </Field>
          <div className="-mt-3 flex flex-wrap items-start justify-between gap-3">
            <ul className="grid gap-x-6 gap-y-1 text-xs text-ink-soft sm:grid-cols-2">
              {PROMPTS.map((p) => (
                <li key={p} className="flex gap-1.5">
                  <span aria-hidden className="text-ink-faint">
                    –
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <span className="text-xs text-ink-faint tabular-nums" aria-live="polite">
              {words} {words === 1 ? "word" : "words"}
            </span>
          </div>
        </Section>

        {error && (
          <p role="alert" className="mx-6 mb-4 rounded-md bg-bad-tint px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-line-soft px-6 py-4">
          <button type="button" onClick={() => router.push("/cases")} className={btn.secondary}>
            Cancel
          </button>
          <button disabled={saving} className={btn.primary}>
            {saving && <Spinner />}
            {saving ? "Creating…" : "Create case"}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="rounded-lg border bg-white p-5 text-sm">
          <h2 className="font-medium">What happens next</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-ink-soft">
            <li>Upload the contract, correspondence and any evidence of loss.</li>
            <li>Run the assessment. Facts are extracted with quotes from your documents.</li>
            <li>Review and record your decision. Nothing is final until you do.</li>
          </ol>
        </section>
        <p className="rounded-lg bg-warn-tint px-4 py-3 text-xs leading-relaxed text-warn">
          This is a demo. Use fictional details only, never real client information.
        </p>
      </aside>
    </div>
  );
}
