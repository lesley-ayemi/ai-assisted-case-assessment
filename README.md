# CaseIQ: AI-Assisted Case Assessment

> Working name. Product naming is set in `backend/app/config.py` and `NEXT_PUBLIC_PRODUCT_NAME`.

A portfolio demo of an AI workflow for **solicitors in England and Wales** handling **contract disputes**. A solicitor creates a case and uploads documents. The system extracts facts with verbatim source quotes, retrieves relevant statutory provisions from legislation.gov.uk, scores how completely the evidence covers each element of the claim, flags limitation risk, and queues the result for human review.

**It does not predict outcomes and does not give legal advice.** All data is fictional.

## What it shows

| Capability | Where |
|---|---|
| Structured LLM output with Pydantic validation | `backend/app/services/extraction.py` |
| Hallucination check: every quote must appear verbatim in its cited document, and facts that fail don't count toward the score | `unverified_quotes()` |
| Legal RAG: BM25 retrieval over 57 statutory provisions, with lay-to-legal query expansion | `backend/app/services/legal_search.py` |
| Citation check: every statutory citation must be a retrieved provision and quote it verbatim | `unverified_citations()` |
| Explainable, deterministic evidence-readiness score (not a win probability) | `backend/app/services/readiness.py` |
| Limitation Act 1980 s.5 check (six years for simple contracts) | `limitation_flags()` |
| Human-in-the-loop review with audit trail | `POST /cases/{id}/assessments/{id}/review` |
| PDF assessment report: review status, verification marks, sources and attribution | `backend/app/services/report.py` |
| Evaluation suite: offline retrieval metrics plus full-pipeline checks | `evals/` |
| Playwright end-to-end test: intake, upload, assessment, PDF download, review | `frontend/e2e/` |

## Architecture

```
Next.js (TypeScript, Tailwind)  ──►  FastAPI  ──►  PostgreSQL (SQLite for local dev)
                                        │
                                        ├─► PyMuPDF (PDF text extraction)
                                        ├─► BM25 retriever ◄── data/legislation/sections.json
                                        │                        (legislation.gov.uk, OGL v3.0)
                                        └─► Claude API (structured facts + cited legal issues)
```

### How legal retrieval works

1. `scripts/ingest_legislation.py` fetches 57 sections from seven Acts (Limitation Act 1980, Sale of Goods Act 1979, Supply of Goods and Services Act 1982, Late Payment of Commercial Debts (Interest) Act 1998, Unfair Contract Terms Act 1977, Misrepresentation Act 1967, Contracts (Rights of Third Parties) Act 1999) through the legislation.gov.uk XML API, and saves the parsed text to `backend/data/legislation/sections.json`.
2. For each case, the top 6 provisions are retrieved with BM25. The client's description leads the search, and the uploaded documents are a secondary signal (weighted rank fusion), because document boilerplate drowns out the signal when everything goes into one query.
3. Clients describe problems in everyday words ("cracked", "unpaid invoice") while statutes use legal terms ("satisfactory quality", "qualifying debt"). A small, readable expansion table bridges the gap.
4. The model receives the provisions and may cite only those, by ID, with a verbatim quote. Every citation is checked against the statute text, and the UI marks each one verified or not.
5. Limitation Act 1980 s.5 isn't retrieved: the rule-based limitation check applies it to every case and cites it.

Retrieval sits behind a `Retriever` interface, so vector or hybrid search (for example pgvector with an embeddings model) can be added later and compared on the same eval.

### PDF report

Each assessment exports as an A4 PDF for the solicitor's file (`GET /cases/{id}/assessments/{id}/report.pdf`, or **Download PDF report** on the case page). It shows the review status prominently (a draft can't pass as approved), the readiness breakdown and flags, every fact and citation marked verified or not, the questions for the solicitor, the review record, and the provisions considered with Open Government Licence attribution.

See [`docs/sample-report.pdf`](docs/sample-report.pdf). It is illustrative: the facts were written by hand for eval case 04, not produced by the model. One deliberately fabricated quote shows how an unverified fact is flagged and left out of the score (Causation stays "missing").

Rendering uses PyMuPDF's HTML-to-PDF Story API, so no extra dependency is needed. The layout avoids CSS background fills, because Story repaints them onto later pages.

## Running locally

You need Python 3.11+ and Node 20+. Docker is optional.

### 1. Backend

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env
```

Edit `backend/.env`:

- **Database:** with no Postgres, comment out the Postgres `DATABASE_URL` and uncomment `DATABASE_URL=sqlite:///./dev.db`. To use Postgres, run `docker compose up -d db` and keep the default line.
- **Extraction:** pick one.
  - With an API key, set `ANTHROPIC_API_KEY`. Each assessment costs some API credit.
  - Without one, uncomment `LLM_PROVIDER=stub`. A keyword matcher quotes lines of the documents instead of a model, and the case page shows a "Stub mode" notice. It's for trying the workflow, not real analysis.

```bash
.venv/bin/uvicorn app.main:app --reload
```

To check it's running, open http://localhost:8000/health. API docs are at http://localhost:8000/docs.

To refresh the legislation corpus: `.venv/bin/python scripts/ingest_legislation.py`

### 2. Frontend (second terminal)

```bash
cd frontend
cp .env.example .env.local
npm install && npm run dev
```

Open http://localhost:3000.

### 3. Try it

The 20 fictional cases in `evals/cases/` make ready-made test data: each folder has a `case.json` (title, parties, breach date, description) and the documents to upload.

1. **Create a case:** click **New case** and copy the details from `evals/cases/04-defective-worktops/case.json`.
2. **Upload documents:** upload the three `.txt` files from that folder, one at a time.
3. **Run the assessment.** Check:
   - the readiness score and the six claim elements
   - the extracted facts, each with its source quote
   - **Relevant legislation**, with each citation marked verified or not
   - **Provisions considered**, where Limitation Act s.5 should say "applied by the limitation check"
4. **Download PDF report:** it should show a "DRAFT: NOT YET REVIEWED" banner.
5. **Review it:** add a note and click **Approve with amendments**. Download the PDF again and the banner should have changed.
6. **Back on Cases:** the case should show as "reviewed".
7. **Legislation page:** try the example searches, or describe a problem in plain words.

Other cases worth trying:

- `07-near-limitation` (breach 2021-02-10): a warning that the limitation period expires on 2027-02-10.
- `11-description-only`: no documents, so most elements come out missing.

**Troubleshooting**

- **"Could not reach the API" on the case list:** the backend isn't running on port 8000, or `NEXT_PUBLIC_API_URL` in `frontend/.env.local` points somewhere else.
- **Starting again:** stop the backend, delete `backend/dev.db`, and restart it.

## Tests and evals

```bash
cd backend && .venv/bin/pytest                                  # no API key or database needed
backend/.venv/bin/python evals/run_evals.py --retrieval-only    # offline retrieval eval, free
backend/.venv/bin/python evals/run_evals.py                     # full pipeline; costs API credit
cd frontend && npx playwright install chromium && npm run test:e2e   # browser end-to-end test
```

Stop `npm run dev` before running the end-to-end test: it starts its own servers, and two Next.js dev servers in the same folder can clash.

### End-to-end test

`frontend/e2e/case-workflow.spec.ts` drives the app in Chromium the way a solicitor would: create a case, upload the three documents from eval case 04, run the assessment, check that facts and statutory citations are marked verified and that Limitation Act s.5 is applied by rule, download the PDF report, approve it with amendments, and confirm the case list shows it as reviewed. Two smaller tests cover rejected uploads and legislation search.

Playwright starts its own backend (fresh SQLite database, port 8010) and frontend (port 3010), so it doesn't touch your dev data. The backend runs with `LLM_PROVIDER=stub`, a deterministic keyword extractor that quotes lines of the documents verbatim, so the test needs no API key and gives the same result every run. The stub does no real analysis: it tests the workflow, and the evals test the model. Assessments it produces are recorded with the model `stub`.

The full eval checks, per case: every quote is traceable to its source, every statutory citation is verified, the expected claim elements are found or correctly marked missing, key facts are mentioned, limitation flags fire, expected provisions are cited, and the readiness score falls in the hand-labelled range.

### Retrieval results

Nine cases are labelled with the provisions a solicitor would expect to see (13 labels in all). Retrieval doesn't use the model, so this runs offline:

| Retriever | Recall@6 | MRR |
|---|---|---|
| BM25 + query expansion (current) | **77%** | 0.33 |
| BM25 only | 15% | 0.04 |

Most of the improvement comes from the expansion table and from leading with the client's description. Searching on the whole case file at once scored 46%.

Caveats: 13 labels is a small sample, and the expansion table and retrieval design were developed against these same cases, so the figures are optimistic. The remaining misses are short, central sections (Late Payment Act s.1, Sale of Goods Act s.49, Supply of Goods and Services Act 1982 s.15) that lose out to longer, related sections. `pytest` fails if recall drops below 70%.

### The eval set

20 fictional England and Wales commercial contract disputes in `evals/cases/`, each with a `notes` field saying what it tests. Each case has a fixed `as_of` date so the limitation checks don't change from one run to the next.

| Scenario | Cases |
|---|---|
| Strong evidence across most elements | 01, 04, 08, 12, 15, 16 |
| Thin evidence: oral agreement, no documents | 05, 11 |
| Loss asserted but not quantified | 02, 13 |
| Disputed causation or breach | 09, 14 |
| Limitation: expired, close to expiry, breach date unknown | 03, 19 · 07 · 06, 14 |
| Terms that cut against the client: liability cap, contradicting contract | 10, 20 |
| Claimant is the supplier or licensor | 01, 07, 12, 17, 19 |
| Counterparty solvency risk | 18 |

`pytest` validates every fixture (documents exist, labels are valid, key phrases appear in the source, provision labels exist in the corpus, and limitation labels match the rules) without calling the model.

## Roadmap

- [x] Case intake, document upload, PDF and text extraction
- [x] Structured fact extraction with source quotes
- [x] Evidence-readiness score and limitation check
- [x] Solicitor review with audit trail
- [x] Eval harness with 20 fictional cases
- [x] Legal RAG over legislation.gov.uk with citation checking and an offline retrieval eval
- [ ] Run the full evals and publish results in this README
- [ ] Hybrid retrieval (BM25 + embeddings) compared on the retrieval eval; more labelled cases
- [x] PDF assessment report export
- [x] Playwright end-to-end test
- [ ] Deploy (Render or Fly with managed Postgres) and record a 2-minute demo video

## Data and licensing

Case material in `evals/cases/` is entirely fictional.

Statutory text in `backend/data/legislation/` contains public sector information from legislation.gov.uk, licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). It is the latest revised text on the retrieval date recorded in the file, and may not include amendments legislation.gov.uk has yet to incorporate. Case law isn't included: the National Archives' Find Case Law has its own licence terms for computational use, and BAILII's terms prohibit scraping.
