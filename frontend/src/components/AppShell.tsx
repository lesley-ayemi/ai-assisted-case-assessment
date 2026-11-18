"use client";

import {
  BookOpenText,
  FolderOpen,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type Case, type Health } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/product";

const COLLAPSE_KEY = "caseiq:sidebar-collapsed";

const STATUS_DOT: Record<string, string> = {
  intake: "bg-ink-faint",
  awaiting_review: "bg-warn",
  reviewed: "bg-ok",
};

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" title={PRODUCT_NAME}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-ink font-serif text-lg leading-none text-white"
      >
        §
      </span>
      {!collapsed && <span className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</span>}
    </Link>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm ${collapsed ? "justify-center" : ""} ${
        active ? "bg-brand-tint font-medium text-brand" : "text-ink-soft hover:bg-canvas hover:text-ink"
      }`}
    >
      <Icon size={18} aria-hidden className="shrink-0" />
      {collapsed ? <span className="sr-only">{label}</span> : <span className="flex-1">{label}</span>}
      {!!badge &&
        (collapsed ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warn" aria-label={`${badge} awaiting review`} />
        ) : (
          <span
            className="rounded-full bg-warn-tint px-1.5 text-xs font-medium text-warn tabular-nums"
            title={`${badge} awaiting review`}
          >
            {badge}
          </span>
        ))}
    </Link>
  );
}

function Sidebar({
  pathname,
  cases,
  health,
  collapsed,
  onToggle,
  onNavigate,
  mobile = false,
}: {
  pathname: string;
  cases: Case[];
  health: Health | null;
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  const awaiting = cases.filter((c) => c.status === "awaiting_review").length;
  const recent = [...cases].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  const stub = health?.extraction === "stub";

  return (
    <div className="flex h-full flex-col">
      <div className={`flex h-14 items-center px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Logo collapsed={collapsed} />
        {mobile ? (
          <button onClick={onNavigate} aria-label="Close menu" className="rounded p-1 text-ink-soft hover:bg-canvas">
            <X size={18} />
          </button>
        ) : (
          !collapsed && (
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-ink"
            >
              <PanelLeftClose size={17} />
            </button>
          )
        )}
      </div>

      <div className="px-3 pt-1 pb-3">
        <Link
          href="/cases/new"
          onClick={onNavigate}
          title={collapsed ? "New case" : undefined}
          className={`flex items-center justify-center gap-2 rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-brand-hover ${
            collapsed ? "px-0" : "px-3"
          }`}
        >
          <Plus size={16} aria-hidden />
          {collapsed ? <span className="sr-only">New case</span> : "New case"}
        </Link>
      </div>

      <nav aria-label="Main" className="space-y-0.5 px-3">
        <NavItem
          href="/cases"
          label="Cases"
          icon={FolderOpen}
          active={pathname === "/cases" || /^\/cases\/\d+/.test(pathname)}
          collapsed={collapsed}
          badge={awaiting}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/legislation"
          label="Legislation"
          icon={BookOpenText}
          active={pathname.startsWith("/legislation")}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </nav>

      {!collapsed && recent.length > 0 && (
        <nav aria-label="Recent cases" className="mt-6 px-3">
          <p className="px-2.5 pb-1.5 text-xs text-ink-faint">Recent cases</p>
          <ul className="space-y-0.5">
            {recent.map((c) => {
              const active = pathname === `/cases/${c.id}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
                      active ? "bg-canvas text-ink" : "text-ink-soft hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[c.status] ?? "bg-ink-faint"}`} />
                    <span className="truncate">{c.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="mt-auto space-y-2 p-3">
        {health && (
          <div
            className={`flex items-center gap-2 rounded-md text-xs ${collapsed ? "justify-center py-2" : "px-3 py-2"} ${
              stub ? "bg-warn-tint text-warn" : "bg-ok-tint text-ok"
            }`}
            title={stub ? "Stub mode: facts are tagged by keyword, no AI model is used" : "Facts are extracted with Claude"}
          >
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${stub ? "bg-warn" : "bg-ok"}`} />
            {collapsed ? (
              <span className="sr-only">{stub ? "Stub mode" : "Claude extraction"}</span>
            ) : (
              <span>{stub ? "Stub mode: no AI model" : "Extraction with Claude"}</span>
            )}
          </div>
        )}
        {!collapsed && (
          <p className="px-1 text-xs leading-relaxed text-ink-faint">
            Demo with fictional cases. Not legal advice: every assessment needs a solicitor&apos;s review.
          </p>
        )}
        {collapsed && !mobile && (
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex w-full justify-center rounded p-1.5 text-ink-faint hover:bg-canvas hover:text-ink"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

function Crumbs({ pathname, cases }: { pathname: string; cases: Case[] }) {
  const crumbs: { href?: string; label: string }[] = [];
  if (pathname.startsWith("/legislation")) crumbs.push({ label: "Legislation" });
  else {
    crumbs.push({ href: "/cases", label: "Cases" });
    if (pathname === "/cases/new") crumbs.push({ label: "New case" });
    else if (/^\/cases\/\d+/.test(pathname)) {
      const id = Number(pathname.split("/")[2]);
      crumbs.push({ label: cases.find((c) => c.id === id)?.title ?? `Case ${id}` });
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-ink-soft">
      <ol className="flex items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.label} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-ink-faint">/</span>}
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-ink">{c.label}</span>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Storage unavailable: start expanded.
    }
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  // Refresh counts and recent cases on every navigation (cheap, and keeps the badge honest).
  useEffect(() => {
    api.listCases().then(setCases).catch(() => setCases([]));
  }, [pathname]);

  // "/" focuses the search box, as on most sites with search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // Storage unavailable: the choice just won't persist.
      }
      return !c;
    });
  }

  return (
    <div className={`min-h-screen transition-[padding] ${collapsed ? "lg:pl-16" : "lg:pl-60"}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r bg-white transition-[width] lg:block ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <Sidebar
          pathname={pathname}
          cases={cases}
          health={health}
          collapsed={collapsed}
          onToggle={toggle}
          onNavigate={() => {}}
        />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white">
            <Sidebar
              pathname={pathname}
              cases={cases}
              health={health}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              mobile
            />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur sm:px-6">
        <button
          className="rounded p-1 text-ink-soft hover:bg-canvas lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <Crumbs pathname={pathname} cases={cases} />
        <form
          role="search"
          className="ml-auto hidden w-72 shrink-0 sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length < 2) return;
            router.push(`/legislation?q=${encodeURIComponent(q.trim())}`);
            setQ(""); // the results page shows the query in its own search field
            inputRef.current?.blur();
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
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQ("");
                  inputRef.current?.blur();
                }
              }}
              placeholder="Search legislation"
              className="peer w-full rounded-md border bg-canvas py-1.5 pr-8 pl-9 text-sm placeholder:text-ink-faint focus:border-brand focus:bg-white focus:outline-none"
            />
            {q ? (
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
            ) : (
              <kbd
                aria-hidden
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded border bg-white px-1.5 font-sans text-[11px] text-ink-faint peer-focus:hidden"
              >
                /
              </kbd>
            )}
          </div>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
