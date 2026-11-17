import pymupdf as fitz

from app.schemas import Element, ExtractedFact, ExtractedFacts, SourceRef
from app.services import extraction

CASE = {
    "title": "Unpaid invoices: Harbour Signs",
    "client_name": "Harbour Signs Ltd",
    "counterparty": "Meridian Retail Ltd",
    "description": "Meridian ordered 40 shop signs and has not paid invoice INV-104.",
    "breach_date": "2025-06-30",
}


def make_pdf(text: str) -> bytes:
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), text)
    data = pdf.tobytes()
    pdf.close()
    return data


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_create_and_get_case(client):
    created = client.post("/cases", json=CASE)
    assert created.status_code == 201
    case_id = created.json()["id"]
    assert client.get(f"/cases/{case_id}").json()["title"] == CASE["title"]
    assert len(client.get("/cases").json()) == 1


def test_missing_case_404(client):
    assert client.get("/cases/999").status_code == 404


def test_upload_pdf_extracts_text(client):
    case_id = client.post("/cases", json=CASE).json()["id"]
    r = client.post(
        f"/cases/{case_id}/documents",
        files={"file": ("invoice.pdf", make_pdf("Invoice INV-104 total 4,800 GBP"), "application/pdf")},
    )
    assert r.status_code == 201
    assert r.json()["page_count"] == 1


def test_upload_rejects_unsupported(client):
    case_id = client.post("/cases", json=CASE).json()["id"]
    r = client.post(
        f"/cases/{case_id}/documents", files={"file": ("x.exe", b"MZ", "application/octet-stream")}
    )
    assert r.status_code == 415


def test_assessment_and_review_flow(client, monkeypatch):
    fake = ExtractedFacts(
        parties=["Harbour Signs Ltd", "Meridian Retail Ltd"],
        facts=[
            ExtractedFact(
                statement="Invoice unpaid",
                element=Element.BREACH,
                source=SourceRef(document_id=0, quote="has not paid invoice INV-104"),
            )
        ],
        open_questions=["Was there a signed order form?"],
    )
    monkeypatch.setattr(extraction, "extract_facts", lambda *a, **k: fake)

    case_id = client.post("/cases", json=CASE).json()["id"]
    r = client.post(f"/cases/{case_id}/assessments")
    assert r.status_code == 201
    body = r.json()
    assert body["review_status"] == "pending"
    assert 0 <= body["readiness"]["score"] <= 100

    review_url = f"/cases/{case_id}/assessments/{body['id']}/review"
    r = client.post(review_url, json={"decision": "approved", "note": "Agree"})
    assert r.json()["review_status"] == "approved"
    assert r.json()["reviewed_at"] is not None
    assert client.post(review_url, json={"decision": "rejected"}).status_code == 409
    assert client.get(f"/cases/{case_id}").json()["status"] == "reviewed"


def test_unverified_quotes_catches_fabrication():
    facts = ExtractedFacts(
        parties=[],
        facts=[
            ExtractedFact(
                statement="ok",
                element=Element.BREACH,
                source=SourceRef(document_id=0, quote="has  NOT paid"),
            ),
            ExtractedFact(
                statement="made up",
                element=Element.LOSS,
                source=SourceRef(document_id=0, quote="lost a major client"),
            ),
        ],
        open_questions=[],
    )
    bad = extraction.unverified_quotes(facts, CASE["description"], [])
    assert bad == ["lost a major client"]
