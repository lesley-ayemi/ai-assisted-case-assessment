"use client";

import { CircleAlert, LoaderCircle, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

const ACCEPT = [".pdf", ".txt", ".md", ".eml"];
const MAX_BYTES = 20 * 1024 * 1024; // matches the backend limit

type Item = { key: string; name: string; size: number; state: "waiting" | "uploading" | "error"; error?: string };

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function problem(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPT.includes(ext)) return "This file type isn't supported. Upload a PDF, text or email file.";
  if (file.size > MAX_BYTES) return "This file is over the 20 MB limit.";
  return null;
}

/**
 * Drop zone for case documents. Takes several files at once and uploads them one at a time
 * (the API takes one file per request), showing progress and a reason for any that fail.
 */
export default function DocumentUpload({
  caseId,
  disabled,
  onUploaded,
  onBusyChange,
}: {
  caseId: number;
  disabled: boolean;
  onUploaded: () => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploading = items.some((i) => i.state !== "error");

  const update = (key: string, patch: Partial<Item>) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function add(files: File[]) {
    if (!files.length || disabled || uploading) return;
    const batch = files.map((f, n) => ({
      file: f,
      item: {
        key: `${Date.now()}-${n}`,
        name: f.name,
        size: f.size,
        state: problem(f) ? "error" : "waiting",
        error: problem(f) ?? undefined,
      } as Item,
    }));
    setItems((all) => [...all.filter((i) => i.state === "error"), ...batch.map((b) => b.item)]);

    const todo = batch.filter((b) => b.item.state === "waiting");
    if (!todo.length) return;
    onBusyChange(true);
    for (const { file, item } of todo) {
      update(item.key, { state: "uploading" });
      try {
        await api.uploadDocument(caseId, file);
        await onUploaded();
        setItems((all) => all.filter((i) => i.key !== item.key));
      } catch (e) {
        update(item.key, { state: "error", error: e instanceof Error ? e.message : "Upload failed" });
      }
    }
    onBusyChange(false);
  }

  const locked = disabled || uploading;

  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add([...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
          dragging
            ? "border-brand bg-brand-tint"
            : locked
              ? "cursor-wait border-line bg-canvas/60"
              : "cursor-pointer border-line hover:border-brand/50 hover:bg-canvas/60"
        } has-[:focus-visible]:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/20`}
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand-tint text-brand">
          <Upload size={17} aria-hidden />
        </span>
        <span className="mt-2 text-sm font-medium">
          {dragging ? "Drop to upload" : <>Drag files here or <span className="text-brand underline underline-offset-2">browse</span></>}
        </span>
        <span className="mt-0.5 text-xs text-ink-soft">PDF, TXT, MD or EML, up to 20 MB each</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          disabled={locked}
          aria-label="Upload documents"
          className="sr-only"
          onChange={(e) => {
            add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul aria-label="Uploads" className="space-y-1.5">
          {items.map((i) => (
            <li
              key={i.key}
              className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm ${
                i.state === "error" ? "border-bad/30 bg-bad-tint" : "bg-white"
              }`}
            >
              {i.state === "error" ? (
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-bad" aria-hidden />
              ) : (
                <LoaderCircle
                  size={16}
                  className={`mt-0.5 shrink-0 text-brand ${i.state === "uploading" ? "animate-spin" : "opacity-40"}`}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">{i.name}</p>
                {i.state === "error" ? (
                  <p role="alert" className="text-xs text-bad">
                    {i.error}
                  </p>
                ) : (
                  <p className="text-xs text-ink-soft">
                    {i.state === "uploading" ? "Uploading and reading text…" : "Waiting"}, {formatSize(i.size)}
                  </p>
                )}
              </div>
              {i.state === "error" && (
                <button
                  type="button"
                  onClick={() => setItems((all) => all.filter((x) => x.key !== i.key))}
                  aria-label={`Dismiss ${i.name}`}
                  className="grid size-6 shrink-0 place-items-center rounded text-bad hover:bg-bad/10"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
