import { CircleCheck, FolderOpen, Hourglass, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { btn, caseStatus, Pill, StatCard } from "@/components/ui";
import { api, type Case } from "@/lib/api";

export const dynamic = "force-dynamic";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function CasesPage() {
  let cases: Case[] = [];
  let error: string | null = null;
  try {
    cases = await api.listCases();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the API";
  }
  const count = (s: string) => cases.filter((c) => c.status === s).length;
  const sorted = [...cases].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Contract disputes being assessed for evidence readiness.
          </p>
        </div>
        <Link href="/cases/new" className={btn.primary}>
          <Plus size={16} aria-hidden />
          New case
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-bad/30 bg-bad-tint p-3 text-sm text-bad">
          {error}. Check the backend is running on port 8000.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderOpen} label="All cases" value={cases.length} />
        <StatCard icon={Inbox} label="Intake" value={count("intake")} note="No assessment yet" />
        <StatCard icon={Hourglass} label="Awaiting review" value={count("awaiting_review")} note="Assessed, needs a solicitor" />
        <StatCard icon={CircleCheck} label="Reviewed" value={count("reviewed")} />
      </div>

      <section className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b border-line-soft px-5 py-3.5">
          <h2 className="font-medium">All cases</h2>
        </div>
        {!error && cases.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium">Open your first case</p>
            <p className="mt-1 text-sm text-ink-soft">
              Add the parties and what happened, then upload the documents.
            </p>
            <Link href="/cases/new" className={`${btn.primary} mt-4`}>
              New case
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-canvas text-left text-xs text-ink-soft">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Case</th>
                  <th className="px-5 py-2.5 font-medium">Breach date</th>
                  <th className="px-5 py-2.5 font-medium">Documents</th>
                  <th className="px-5 py-2.5 font-medium">Opened</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {sorted.map((c) => {
                  const s = caseStatus(c.status);
                  return (
                    <tr key={c.id} className="hover:bg-canvas/60">
                      <td className="px-5 py-3">
                        <Link href={`/cases/${c.id}`} className="font-medium hover:text-brand hover:underline">
                          {c.title}
                        </Link>
                        <p className="text-ink-soft">
                          {c.client_name} v {c.counterparty}
                        </p>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{c.breach_date ? date(c.breach_date) : "Unknown"}</td>
                      <td className="px-5 py-3 tabular-nums">{c.documents.length}</td>
                      <td className="px-5 py-3 tabular-nums">{date(c.created_at)}</td>
                      <td className="px-5 py-3">
                        <Pill tone={s.tone}>{s.label}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
