# CaseIQ: AI-Assisted Case Assessment

> Working name. Product naming is set in `backend/app/config.py` and `NEXT_PUBLIC_PRODUCT_NAME`.

A portfolio demo of an AI workflow for **solicitors in England and Wales** handling **contract disputes**. A solicitor creates a case and uploads documents. The system extracts facts with verbatim source quotes, scores how completely the evidence covers each element of the claim, flags limitation risk, and queues the result for human review.

**It does not predict outcomes and does not give legal advice.** All data is fictional.

## What it shows

| Capability | Where |
|---|---|
| Structured LLM output with Pydantic validation | `backend/app/services/extraction.py` |
| Hallucination check: every quote must appear verbatim in its cited document | `unverified_quotes()` |
| Explainable, deterministic evidence-readiness score (not a win probability) | `backend/app/services/readiness.py` |
| Limitation Act 1980 s.5 check (six years for simple contracts) | `limitation_flags()` |
| Human-in-the-loop review with audit trail | `POST /cases/{id}/assessments/{id}/review` |
| Evaluation suite on hand-labelled fictional cases | `evals/` |

## Architecture

```
Next.js (TypeScript, Tailwind)  ──►  FastAPI  ──►  PostgreSQL (+ pgvector, Phase 2)
                                        │
                                        ├─► PyMuPDF (PDF text extraction)
                                        └─► Claude API (structured fact extraction)
```

## Running locally

**Backend**

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env   # add ANTHROPIC_API_KEY; use the SQLite line if you have no Postgres
.venv/bin/uvicorn app.main:app --reload
```

Postgres with pgvector (optional until Phase 2): `docker compose up -d db`

**Frontend**

```bash
cd frontend
cp .env.example .env.local
npm install && npm run dev
```

Open http://localhost:3000.

## Tests and evals

```bash
cd backend && .venv/bin/pytest          # unit and API tests; no API key or database needed
backend/.venv/bin/python evals/run_evals.py   # calls the model; costs API credit
```

The eval checks, per case: every quote is traceable to its source, the expected claim elements are found or correctly marked missing, key facts are mentioned, limitation flags fire, and the readiness score falls in the hand-labelled range.

## Roadmap

- [x] Case intake, document upload, PDF and text extraction
- [x] Structured fact extraction with source quotes
- [x] Evidence-readiness score and limitation check
- [x] Solicitor review with audit trail
- [x] Eval harness with 3 fictional cases
- [ ] Grow the eval set to 20–30 cases; publish results in this README
- [ ] Legal-source RAG over legislation.gov.uk (Open Government Licence) with citation checking
- [ ] PDF assessment report export
- [ ] Playwright end-to-end test
- [ ] Deploy (Render or Fly with managed Postgres) and record a 2-minute demo video

## Data and licensing

Case material in `evals/cases/` is entirely fictional. Planned legal sources: legislation.gov.uk under the Open Government Licence v3.0. Case law from the National Archives' Find Case Law is subject to its own licence terms for computational use. BAILII is not used: its terms prohibit scraping.
