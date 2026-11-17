import Link from "next/link";
import { api, type Case } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let cases: Case[] = [];
  let error: string | null = null;
  try {
    cases = await api.listCases();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the API";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cases</h1>
        <Link
          href="/cases/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New case
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}. Is the backend running on port 8000?
        </p>
      )}

      {!error && cases.length === 0 && (
        <p className="text-slate-500">No cases yet. Create one to get started.</p>
      )}

      <ul className="divide-y rounded-lg border bg-white">
        {cases.map((c) => (
          <li key={c.id}>
            <Link href={`/cases/${c.id}`} className="flex justify-between p-4 hover:bg-slate-50">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-slate-500">
                  {c.client_name} v {c.counterparty}
                </p>
              </div>
              <span className="self-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">
                {c.status.replace("_", " ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
