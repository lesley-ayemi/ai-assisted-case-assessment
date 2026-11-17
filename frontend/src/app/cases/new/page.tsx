"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const input = "w-full rounded-md border px-3 py-2 text-sm";

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
      setError(err instanceof Error ? err.message : "Could not create case");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">New case</h1>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Title</span>
        <input name="title" required className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Client</span>
          <input name="client_name" required className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Counterparty</span>
          <input name="counterparty" required className={input} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Date of alleged breach</span>
        <input name="breach_date" type="date" className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">What happened?</span>
        <textarea name="description" required rows={6} className={input} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={saving}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create case"}
      </button>
    </form>
  );
}
