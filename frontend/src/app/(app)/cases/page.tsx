import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { btn, caseStatus, Pill } from "@/components/ui";
import { api, type Case } from "@/lib/api";

export const dynamic = "force-dynamic";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// The stages a case moves through, in order.
const STAGES = [
  { status: "intake", label: "Intake", note: "No assessment yet" },
  { status: "awaiting_review", label: "Awaiting review", note: "Needs a solicitor's decision" },
  { status: "reviewed", label: "Reviewed", note: "Decision recorded" },
] as const;

type Stage = (typeof STAGES)[number]["status"];

function StageLink({
  href,
  active,
  label,
  note,
  count,
  attention = false,
}: {
  href: string;
  active: boolean;
  label: string;
  note: string;
  count: number;
  attention?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block flex-1 rounded-md px-4 py-3 transition-colors ${
        active ? "bg-brand-tint ring-1 ring-brand/40" : "hover:bg-canvas"
      }`}
    >
      <span className={`block text-sm ${active ? "font-medium text-brand" : "text-ink-soft"}`}>{label}</span>
      <span className={`mt-1 block text-2xl font-semibold tabular-nums ${attention && count ? "text-warn" : ""}`}>
        {count}
      </span>
      <span className="mt-0.5 block text-xs text-ink-soft">{note}</span>
    </Link>
  );
}

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status;
  const filter = STAGES.find((s) => s.status === requested)?.status as Stage | undefined;

  let cases: Case[] = [];
  let error: string | null = null;
  try {
    cases = await api.listCases();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach the API";
  }
  const count = (s: string) => cases.filter((c) => c.status === s).length;
  const shown = [...cases]
    .filter((c) => !filter || c.status === filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const stage = STAGES.find((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-ink-soft">Contract disputes being assessed for evidence readiness.</p>
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

      <nav aria-label="Filter cases by stage" className="rounded-lg border bg-white p-1.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-stretch">
          <StageLink href="/cases" active={!filter} label="All cases" note="Every open matter" count={cases.length} />
          <span className="mx-1 hidden w-px self-stretch bg-line-soft sm:block" aria-hidden />
          {STAGES.map((s, i) => (
            <div key={s.status} className="flex flex-1 items-stretch gap-1">
              {i > 0 && <ChevronRight size={16} className="hidden shrink-0 self-center text-ink-faint sm:block" aria-hidden />}
              <StageLink
                href={filter === s.status ? "/cases" : `/cases?status=${s.status}`}
                active={filter === s.status}
                label={s.label}
                note={s.note}
                count={count(s.status)}
                attention={s.status === "awaiting_review"}
              />
            </div>
          ))}
        </div>
      </nav>

      <section className="overflow-hidden rounded-lg border bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
          <h2 className="font-medium">
            {stage ? stage.label : "All cases"}
            <span className="ml-2 text-sm font-normal text-ink-soft">{shown.length}</span>
          </h2>
          {stage && (
            <Link href="/cases" className="text-sm text-ink-soft hover:text-ink">
              Show all cases
            </Link>
          )}
        </div>
        {!error && cases.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium">Open your first case</p>
            <p className="mt-1 text-sm text-ink-soft">Add the parties and what happened, then upload the documents.</p>
            <Link href="/cases/new" className={`${btn.primary} mt-4`}>
              New case
            </Link>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            No cases at the {stage?.label.toLowerCase()} stage.
          </p>
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
                {shown.map((c) => {
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
