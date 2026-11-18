"use client";

import { Eye, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import { Card } from "@/components/ui";
import { api, type Assessment, type DocumentOut } from "@/lib/api";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function FileBadge({ filename }: { filename: string }) {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE";
  const tone =
    ext === "PDF" ? "bg-bad-tint text-bad" : ext === "EML" ? "bg-brand-tint text-brand" : "bg-line-soft text-ink-soft";
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${tone}`} aria-hidden>
      {ext}
    </span>
  );
}

/** Splits text around every quote (whitespace-tolerant) and marks the quoted parts. */
function withHighlights(text: string, quotes: string[]) {
  const patterns = [...new Set(quotes)]
    .filter((q) => q.trim())
    .sort((a, b) => b.length - a.length)
    .map((q) =>
      q
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("\\s+"),
    );
  if (!patterns.length) return [text];
  const re = new RegExp(`(${patterns.join("|")})`, "g");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

function DocumentViewer({
  caseId,
  doc,
  quotes,
  onClose,
}: {
  caseId: number;
  doc: DocumentOut;
  quotes: string[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    api
      .getDocument(caseId, doc.id)
      .then((d) => setText(d.text))
      .catch(() => setError(true));
  }, [caseId, doc.id]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-labelledby="doc-viewer-title"
      className="m-auto w-[min(720px,calc(100vw-2rem))] rounded-xl border bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4">
        <FileBadge filename={doc.filename} />
        <div className="min-w-0 flex-1">
          <h2 id="doc-viewer-title" className="truncate font-medium">
            {doc.filename}
          </h2>
          <p className="text-xs text-ink-soft">
            {doc.page_count} {doc.page_count === 1 ? "page" : "pages"}, added {shortDate(doc.uploaded_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-canvas hover:text-ink"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
        {text === null ? (
          <p className="text-sm text-ink-soft">{error ? "Couldn't load the document text." : "Loading…"}</p>
        ) : (
          <p className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">{withHighlights(text, quotes)}</p>
        )}
      </div>
      <p className="border-t border-line-soft px-5 py-3 text-xs text-ink-soft">
        The text as extracted for analysis.
        {quotes.length > 0 && " Highlighted passages are quoted by extracted facts."}
      </p>
    </dialog>
  );
}

export default function DocumentsPanel({
  caseId,
  documents,
  assessment,
  disabled,
  onUploaded,
  onBusyChange,
}: {
  caseId: number;
  documents: DocumentOut[];
  assessment?: Assessment;
  disabled: boolean;
  onUploaded: () => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [viewing, setViewing] = useState<DocumentOut | null>(null);
  const unverified = new Set(assessment?.verification.unverified_quotes ?? []);
  const citing = (docId: number) => (assessment?.facts.facts ?? []).filter((f) => f.source.document_id === docId);

  return (
    <Card title="Documents" action={<span className="text-xs text-ink-soft">{documents.length}</span>}>
      {documents.length > 0 ? (
        <ul aria-label="Documents" className="-mt-1 mb-4 divide-y divide-line-soft">
          {documents.map((d) => {
            const facts = citing(d.id);
            return (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <FileBadge filename={d.filename} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={d.filename}>
                    {d.filename}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {d.page_count} {d.page_count === 1 ? "page" : "pages"}
                    {assessment && (
                      <>
                        ,{" "}
                        <span className={facts.length ? "text-brand" : ""}>
                          {facts.length ? `${facts.length} ${facts.length === 1 ? "fact" : "facts"}` : "no facts"}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewing(d)}
                  aria-label={`View ${d.filename}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-canvas hover:text-ink"
                >
                  <Eye size={14} aria-hidden />
                  View
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-ink-soft">
          None uploaded yet. Add the contract, correspondence and any evidence of loss.
        </p>
      )}

      <DocumentUpload
        caseId={caseId}
        compact={documents.length > 0}
        disabled={disabled}
        onUploaded={onUploaded}
        onBusyChange={onBusyChange}
      />

      {viewing && (
        <DocumentViewer
          caseId={caseId}
          doc={viewing}
          quotes={citing(viewing.id)
            .map((f) => f.source.quote)
            .filter((q) => !unverified.has(q))}
          onClose={() => setViewing(null)}
        />
      )}
    </Card>
  );
}
