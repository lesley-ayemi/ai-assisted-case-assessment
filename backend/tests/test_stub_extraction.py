import json
from pathlib import Path

from app.services import stub_extraction
from app.services.extraction import unverified_citations, unverified_quotes
from app.services.legal_search import search_case

CASE = Path(__file__).resolve().parents[2] / "evals/cases/04-defective-worktops"


def test_stub_quotes_and_citations_all_verify():
    spec = json.loads((CASE / "case.json").read_text())
    docs = [(i + 1, n, (CASE / n).read_text()) for i, n in enumerate(spec["documents"])]
    provisions = [h.provision for h in search_case(spec["description"], [t for *_, t in docs])]

    facts = stub_extraction.extract_facts(spec["description"], docs, provisions)

    assert len(facts.facts) >= 6
    assert len(facts.legal_issues) == 2
    assert unverified_quotes(facts, spec["description"], docs) == []
    assert unverified_citations(facts, provisions) == []


def test_stub_selected_by_setting(client, monkeypatch):
    monkeypatch.setattr("app.routers.cases.settings.llm_provider", "stub")
    case = client.post("/cases", json={
        "title": "t", "client_name": "A Ltd", "counterparty": "B Ltd",
        "description": "Our signed agreement required delivery by May. They failed to deliver. We lost £5,000.",
        "breach_date": None,
    }).json()
    body = client.post(f"/cases/{case['id']}/assessments").json()
    assert body["model"] == "stub"
    assert body["verification"]["unverified_quotes"] == []
