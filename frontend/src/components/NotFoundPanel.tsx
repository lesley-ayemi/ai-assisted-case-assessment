import { BookOpenText, FolderOpen } from "lucide-react";
import Link from "next/link";

/** The body of a "not found" page, shared by the site-wide 404 and a missing case. */
export default function NotFoundPanel({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center sm:py-16">
      <p className="font-serif text-6xl leading-none text-ink-faint" aria-hidden>
        &sect;
      </p>
      <p className="mt-5 text-sm text-ink-soft">Error 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mx-auto mt-3 max-w-md leading-relaxed text-ink-soft">{body}</div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          <FolderOpen size={16} aria-hidden />
          Go to cases
        </Link>
        <Link
          href="/legislation"
          className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium hover:bg-canvas"
        >
          <BookOpenText size={16} aria-hidden />
          Search legislation
        </Link>
      </div>
    </div>
  );
}
