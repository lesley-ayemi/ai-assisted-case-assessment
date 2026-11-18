"use client";

import { BookOpenText, FolderOpen, Menu, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PRODUCT_NAME } from "@/lib/product";

const NAV = [
  { href: "/cases", label: "Cases", icon: FolderOpen, match: (p: string) => p === "/cases" || /^\/cases\/\d+/.test(p) },
  { href: "/cases/new", label: "New case", icon: Plus, match: (p: string) => p === "/cases/new" },
  { href: "/legislation", label: "Legislation", icon: BookOpenText, match: (p: string) => p.startsWith("/legislation") },
];

function Crumbs({ pathname }: { pathname: string }) {
  const crumbs: { href?: string; label: string }[] = [{ href: "/cases", label: "Cases" }];
  if (pathname === "/cases/new") crumbs.push({ label: "New case" });
  else if (/^\/cases\/\d+/.test(pathname)) crumbs.push({ label: `Case ${pathname.split("/")[2]}` });
  else if (pathname.startsWith("/legislation")) crumbs.splice(0, 1, { label: "Legislation" });

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
      <ol className="flex items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className="text-ink">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          {PRODUCT_NAME}
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                active ? "bg-brand-tint font-medium text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon size={17} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-md bg-canvas p-3 text-xs leading-relaxed text-ink-soft">
        Demo with fictional cases. Not legal advice: every assessment needs a solicitor&apos;s review.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white">{sidebar}</aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4 sm:px-6">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Crumbs pathname={pathname} />
        <form
          role="search"
          className="ml-auto hidden w-72 sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length < 2) return;
            router.push(`/legislation?q=${encodeURIComponent(q.trim())}`);
            setQ(""); // the results page shows the query in its own search field
          }}
        >
          <div className="relative">
            <label htmlFor="topbar-search" className="sr-only">
              Search legislation
            </label>
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              id="topbar-search"
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQ("")}
              placeholder="Search legislation"
              className="w-full rounded-md border bg-canvas py-1.5 pr-8 pl-9 text-sm placeholder:text-ink-faint focus:border-brand focus:bg-white focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-ink-faint hover:bg-line-soft hover:text-ink"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
