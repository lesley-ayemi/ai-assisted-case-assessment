"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { enGB } from "react-day-picker/locale/en-GB";
import { field } from "@/components/ui";
import { limitation, longDate, startOfToday } from "@/lib/limitation";

/**
 * A UK-format date field: type DD/MM/YYYY or pick from a calendar. The value is submitted
 * as an ISO date (YYYY-MM-DD) through a hidden input named `name`, so the form handler
 * doesn't need to know about the display format.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDisplay = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
function parse(text: string): Date | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  const uk = t.match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (uk) [d, m, y] = [Number(uk[1]), Number(uk[2]), Number(uk[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(y, m - 1, d);
  // Reject rollovers such as 31/02/2025.
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

function limitationNote(breach: Date) {
  const { expiry, status } = limitation(breach);
  if (status === "expired") return { text: `Limitation period ended on ${longDate(expiry)}`, tone: "text-bad" };
  if (status === "soon") return { text: `Limitation period ends soon, on ${longDate(expiry)}`, tone: "text-warn" };
  return { text: `Limitation period ends on ${longDate(expiry)}`, tone: "text-ok" };
}

export default function DateField({
  name,
  id,
  "aria-describedby": describedBy,
  defaultValue,
}: {
  /** Initial value as an ISO date (YYYY-MM-DD). */
  defaultValue?: string;
  name: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState(() => {
    const d = defaultValue ? parse(defaultValue) : null;
    return d ? toDisplay(d) : "";
  });
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(startOfToday());
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const today = startOfToday();
  const date = parse(text);
  const error = !text.trim()
    ? null
    : !date
      ? "Enter a date like 12/09/2025"
      : date > today
        ? "The breach date can't be in the future"
        : null;
  const valid = date && !error ? date : null;

  // Block form submission while the text can't be read as a date.
  useEffect(() => {
    input.current?.setCustomValidity(error ?? "");
  }, [error]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrapper.current?.contains(e.target as Node)) {
        setOpen(false);
        if (e instanceof KeyboardEvent) input.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function choose(d: Date | undefined) {
    setText(d ? toDisplay(d) : "");
    setOpen(false);
    input.current?.focus();
  }

  const note = valid ? limitationNote(valid) : null;
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div ref={wrapper} className="relative sm:w-64">
      <input type="hidden" name={name} value={valid ? toISO(valid) : ""} />
      <div className="relative">
        <input
          ref={input}
          id={id}
          value={text}
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={!!error}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => date && setText(toDisplay(date))}
          className={`${field} pr-10 tabular-nums ${error ? "border-bad focus:border-bad focus:ring-bad/15" : ""}`}
        />
        <button
          type="button"
          onClick={() => {
            setMonth(valid ?? today);
            setOpen((o) => !o);
          }}
          aria-label="Choose date from calendar"
          aria-expanded={open}
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded text-ink-soft hover:bg-line-soft hover:text-ink"
        >
          <CalendarDays size={16} aria-hidden />
        </button>
      </div>

      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      )}
      {note && <p className={`mt-1.5 text-xs ${note.tone}`}>{note.text}</p>}

      {open && (
        <div
          role="dialog"
          aria-label="Choose the date of the alleged breach"
          className="absolute top-full left-0 z-20 mt-2 rounded-lg border bg-white p-3 shadow-lg shadow-ink/10"
        >
          <DayPicker
            mode="single"
            locale={enGB}
            weekStartsOn={1}
            captionLayout="dropdown"
            startMonth={new Date(today.getFullYear() - 15, 0)}
            endMonth={today}
            month={month}
            onMonthChange={setMonth}
            selected={valid ?? undefined}
            onSelect={choose}
            disabled={{ after: today }}
            autoFocus
          />
          <div className="mt-2 flex justify-between border-t border-line-soft pt-2 text-sm">
            <button type="button" onClick={() => choose(undefined)} className="rounded px-2 py-1 text-ink-soft hover:bg-canvas hover:text-ink">
              Clear
            </button>
            <button type="button" onClick={() => choose(today)} className="rounded px-2 py-1 font-medium text-brand hover:bg-brand-tint">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
