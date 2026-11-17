import pymupdf
import pytest

from app.schemas import Element, ExtractedFact, ExtractedFacts, LegalIssue, SourceRef
from app.services import extraction

CASE = {
    "title": "Unpaid signage <invoice> & costs",
    "client_name": "Harbour Signs Ltd",
    "counterparty": "Meridian Retail Ltd",
    "description": "Meridian ordered 40 shop signs and has not paid invoice INV-104 for £48,000.",
    "breach_date": "2025-06-30",
}


@pytest.fixture
def assessed(client, monkeypatch):
    """A case with one assessment: one verified fact, one fabricated fact, one bad citation."""

    def fake_extract(description, docs, provisions):
        top = provisions[0]
        return ExtractedFacts(
            parties=["Harbour Signs Ltd", "Meridian Retail Ltd"],
            facts=[
                ExtractedFact(statement="Invoice INV-104 is unpaid", element=Element.BREACH,
                              source=SourceRef(document_id=0, quote="has not paid invoice INV-104")),
                ExtractedFact(statement="Meridian admitted liability", element=Element.BREACH,
                              source=SourceRef(document_id=0, quote="we admit we owe you")),
            ],
            legal_issues=[
                LegalIssue(issue="Statutory interest may be claimed", provision_id=top.id,
                           quote=top.text[:30]),
                LegalIssue(issue="Invented provision", provision_id="ukpga/2099/1/section/1",
                           quote="nothing"),
            ],
            open_questions=["Was the purchase order signed?"],
        )

    monkeypatch.setattr(extraction, "extract_facts", fake_extract)
    case_id = client.post("/cases", json=CASE).json()["id"]
    assessment = client.post(f"/cases/{case_id}/assessments").json()
    return client, case_id, assessment["id"]


def pdf_text(content: bytes) -> tuple[int, str]:
    doc = pymupdf.open(stream=content, filetype="pdf")
    return doc.page_count, "\n".join(page.get_text() for page in doc)


def test_report_downloads_as_pdf(assessed):
    client, case_id, aid = assessed
    r = client.get(f"/cases/{case_id}/assessments/{aid}/report.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert f'filename="assessment-{aid}-unpaid-signage-invoice-costs.pdf"' in r.headers[
        "content-disposition"
    ]


def test_report_contents(assessed):
    client, case_id, aid = assessed
    pages, text = pdf_text(client.get(f"/cases/{case_id}/assessments/{aid}/report.pdf").content)
    flat = " ".join(text.split())

    assert pages >= 1
    assert "Unpaid signage <invoice> & costs" in flat  # escaped, then rendered literally
    assert "DRAFT: NOT YET REVIEWED BY A SOLICITOR" in flat
    assert "£48,000" in flat
    assert "has not paid invoice INV-104" in flat
    assert "Quote not found in source" in flat  # the fabricated fact
    assert "1 fact left out of the score because its quote was not found" in flat
    assert "Could not verify against statute text" in flat  # the invented provision
    assert "Limitation Act 1980, s.5" in flat
    assert "Was the purchase order signed?" in flat
    assert "1 of 2 fact quotes and 1 of 2 statutory citations" in flat
    assert "Open Government Licence" in flat
    assert f"Page 1 of {pages}" in flat
    assert "Not legal advice" in flat


def test_report_reflects_review_decision(assessed):
    client, case_id, aid = assessed
    client.post(f"/cases/{case_id}/assessments/{aid}/review",
                json={"decision": "amended", "note": "Interest point needs checking"})
    _, text = pdf_text(client.get(f"/cases/{case_id}/assessments/{aid}/report.pdf").content)
    flat = " ".join(text.split())
    assert "APPROVED WITH AMENDMENTS" in flat
    assert "Interest point needs checking" in flat
    assert "DRAFT" not in flat


def test_report_for_wrong_case_is_404(assessed):
    client, case_id, aid = assessed
    other = client.post("/cases", json={**CASE, "title": "Other"}).json()["id"]
    assert client.get(f"/cases/{other}/assessments/{aid}/report.pdf").status_code == 404
    assert client.get(f"/cases/{case_id}/assessments/999/report.pdf").status_code == 404
