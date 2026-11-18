import Link from "next/link";
import { PRODUCT_NAME, REPO_URL, SAMPLE_REPORT_URL } from "@/lib/product";

const STEPS = [
  {
    title: "Open a case",
    body: "Record the parties, the date of the alleged breach, and the client's account in their own words.",
  },
  {
    title: "Upload the documents",
    body: "Contracts, emails, inspection reports and invoices, as PDF or text.",
  },
  {
    title: "Review the assessment",
    body: "Check each fact against its source, see which parts of the claim need more evidence, then approve, amend or reject it.",
  },
];

const CHECKS = [
  {
    title: "Every fact quotes its source",
    body: "Each fact carries the exact words from the document it came from. If the quote can't be found in that document, the fact is flagged and left out of the score.",
  },
  {
    title: "Statutory citations are checked",
    body: "Provisions are retrieved from 57 sections of seven Acts on legislation.gov.uk. A citation counts only if it quotes the statute word for word.",
  },
  {
    title: "Evidence readiness, not a win rate",
    body: "A score out of 100 for how well the evidence covers contract, terms, breach, loss, causation and pre-action steps. It never predicts the outcome.",
  },
  {
    title: "Limitation is applied by rule",
    body: "The six-year period under the Limitation Act 1980, s.5 is calculated from the breach date and flagged when it's close or has passed.",
  },
];

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-14 pb-20 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
      <div>
        <h1 className="max-w-xl text-4xl leading-[1.15] font-semibold tracking-tight sm:text-[2.75rem]">
          See what the evidence proves before you take the case on
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
          Upload the client&apos;s documents. {PRODUCT_NAME} pulls out the facts of a contract dispute,
          quotes the line each one comes from, and shows which parts of the claim still need
          evidence.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/cases"
            className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Open the demo
          </Link>
          <a
            href={SAMPLE_REPORT_URL}
            className="rounded-md border border-ink/20 bg-white px-5 py-2.5 text-sm font-medium hover:border-ink/40"
          >
            Read a sample report
          </a>
        </div>
        <p className="mt-6 text-sm text-ink-faint">
          For contract disputes in England and Wales. All case data in the demo is fictional.
        </p>
      </div>

      <figure className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3 text-xs text-ink-soft">
          <span>inspection-report.txt</span>
          <span>Linden Kitchens v Stoneway Surfaces</span>
        </div>
        <blockquote className="space-y-1.5 px-5 py-5 font-serif text-[15px] leading-relaxed text-ink">
          <p>Goods-in inspection report</p>
          <p>Delivery: Stoneway Surfaces, 12 September 2025</p>
          <p>Units received: 2,000</p>
          <p>
            <mark>Units failing inspection: 604 (hairline or through-cracks, mostly at cut-outs)</mark>
          </p>
          <p className="text-ink-faint">Inspector: D. Hughes, Quality Lead</p>
        </blockquote>
        <figcaption className="grid gap-3 border-t border-line-soft px-5 py-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-medium">604 of the 2,000 worktops delivered were cracked</p>
            <p className="text-ink-soft">Counts towards: breach of the quality term</p>
          </div>
          <span className="w-fit rounded bg-ok-tint px-2 py-1 text-xs font-medium text-ok">
            Quote found in source
          </span>
        </figcaption>
      </figure>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="border-b border-line-soft">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-[17px] font-semibold tracking-tight">
            {PRODUCT_NAME}
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6 text-sm text-ink-soft">
            <a href="#how" className="hidden hover:text-ink sm:inline">
              How it works
            </a>
            <a href="#checks" className="hidden hover:text-ink sm:inline">
              What it checks
            </a>
            <Link href="/legislation" className="hidden hover:text-ink md:inline">
              Legislation
            </Link>
            <Link href="/cases" className="font-medium text-ink">
              Open the demo
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <Hero />

        <section id="how" className="border-t border-line-soft bg-canvas">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t-2 border-ink pt-4">
                  <p className="text-sm text-ink-soft">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="checks" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">What it checks</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Language models can invent facts and citations. Each check below is done in code after the
            model has answered, so mistakes are caught rather than trusted.
          </p>
          <dl className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {CHECKS.map((c) => (
              <div key={c.title}>
                <dt className="text-lg font-medium">{c.title}</dt>
                <dd className="mt-2 leading-relaxed text-ink-soft">{c.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-line-soft">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[1fr_1.4fr]">
            <h2 className="text-2xl font-semibold tracking-tight">What it doesn&apos;t do</h2>
            <ul className="space-y-3 leading-relaxed text-ink-soft">
              <li>It doesn&apos;t predict whether a claim will succeed.</li>
              <li>It doesn&apos;t give legal advice. A solicitor reviews every assessment, and the review is recorded.</li>
              <li>It doesn&apos;t include case law. Statutory text comes from legislation.gov.uk only.</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-ink-soft sm:flex-row sm:justify-between">
          <p>A portfolio demo. Fictional data, not legal advice.</p>
          <p>
            Statutory text from legislation.gov.uk under the Open Government Licence v3.0.{" "}
            <a href={REPO_URL} className="underline hover:text-ink">
              Source code
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
