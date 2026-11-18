"use client";

import { useRouter } from "next/navigation";
import { cloneElement, useId, useState } from "react";
import DateField from "@/components/DateField";
import { btn, field } from "@/components/ui";
import { api } from "@/lib/api";

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
    <div>
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

export default function NewCase() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCase({
        title: String(f.get("title")),
        client_name: String(f.get("client_name")),
        counterparty: String(f.get("counterparty")),
        description: String(f.get("description")),
        breach_date: (f.get("breach_date") as string) || null,
      });
      router.push(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the case");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <form onSubmit={onSubmit} className="rounded-lg border bg-white">
        <div className="border-b border-line-soft px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">New case</h1>
          <p className="mt-0.5 text-sm text-ink-soft">You can upload documents on the next screen.</p>
        </div>
        <div className="space-y-5 p-6">
          <Field label="Title">
            <input name="title" required className={field} placeholder="Cracked quartz worktops" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Client">
              <input name="client_name" required className={field} placeholder="Linden Kitchens Ltd" />
            </Field>
            <Field label="Counterparty">
              <input name="counterparty" required className={field} placeholder="Stoneway Surfaces Ltd" />
            </Field>
          </div>
          <Field label="Date of alleged breach" hint="Used to check the limitation period. Leave blank if unknown.">
            <DateField name="breach_date" />
          </Field>
          <Field label="What happened?" hint="The client's account, in their own words.">
            <textarea name="description" required rows={7} className={field} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-line-soft px-6 py-4">
          <button type="button" onClick={() => router.push("/cases")} className={btn.secondary}>
            Cancel
          </button>
          <button disabled={saving} className={btn.primary}>
            {saving ? "Creating…" : "Create case"}
          </button>
        </div>
      </form>

      <aside className="h-fit rounded-lg border bg-white p-5 text-sm">
        <h2 className="font-medium">What happens next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-ink-soft">
          <li>Upload the contract, correspondence and any evidence of loss.</li>
          <li>Run the assessment. Facts are extracted with quotes from your documents.</li>
          <li>Review and record your decision. Nothing is final until you do.</li>
        </ol>
      </aside>
    </div>
  );
}
