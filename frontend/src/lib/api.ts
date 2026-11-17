// Typed client for the FastAPI backend. Mirrors backend/app/schemas.py.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type DocumentOut = {
  id: number;
  filename: string;
  content_type: string;
  page_count: number;
  uploaded_at: string;
};

export type Case = {
  id: number;
  title: string;
  client_name: string;
  counterparty: string;
  description: string;
  breach_date: string | null;
  status: string;
  created_at: string;
  documents: DocumentOut[];
};

export type CaseCreate = Pick<
  Case,
  "title" | "client_name" | "counterparty" | "description" | "breach_date"
>;

export type Element =
  | "contract_formed"
  | "terms_identified"
  | "breach"
  | "loss"
  | "causation"
  | "pre_action";

export type ExtractedFact = {
  statement: string;
  element: Element;
  source: { document_id: number; quote: string };
  date: string | null;
};

export type LegalIssue = { issue: string; provision_id: string; quote: string };

export type ProvisionRef = {
  id: string;
  citation: string;
  title: string;
  url: string;
  via: "search" | "rule";
  score: number | null;
};

export type ProvisionHit = {
  id: string;
  citation: string;
  title: string;
  url: string;
  score: number;
  text: string;
};

export type Assessment = {
  id: number;
  case_id: number;
  facts: {
    parties: string[];
    facts: ExtractedFact[];
    legal_issues: LegalIssue[];
    open_questions: string[];
  };
  sources: ProvisionRef[];
  verification: { unverified_quotes: string[]; unverified_citations: string[] };
  readiness: {
    score: number;
    elements: {
      element: Element;
      status: "supported" | "weak" | "missing";
      fact_count: number;
      weight: number;
    }[];
    flags: string[];
    missing: Element[];
  };
  model: string;
  review_status: "pending" | "approved" | "rejected" | "amended";
  reviewer_note: string;
  created_at: string;
  reviewed_at: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  listCases: () => request<Case[]>("/cases"),
  getCase: (id: number) => request<Case>(`/cases/${id}`),
  createCase: (body: CaseCreate) => request<Case>("/cases", json(body)),
  uploadDocument: (caseId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentOut>(`/cases/${caseId}/documents`, { method: "POST", body: form });
  },
  listAssessments: (caseId: number) => request<Assessment[]>(`/cases/${caseId}/assessments`),
  runAssessment: (caseId: number) =>
    request<Assessment>(`/cases/${caseId}/assessments`, { method: "POST" }),
  searchLegislation: (q: string, k = 8) =>
    request<ProvisionHit[]>(`/legislation/search?${new URLSearchParams({ q, k: String(k) })}`),
  review: (caseId: number, assessmentId: number, decision: string, note: string) =>
    request<Assessment>(
      `/cases/${caseId}/assessments/${assessmentId}/review`,
      json({ decision, note }),
    ),
};

export const ELEMENT_LABELS: Record<Element, string> = {
  contract_formed: "Contract formed",
  terms_identified: "Terms identified",
  breach: "Breach",
  loss: "Loss",
  causation: "Causation",
  pre_action: "Pre-action steps",
};
