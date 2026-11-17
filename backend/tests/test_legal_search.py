from app.schemas import ExtractedFacts, LegalIssue
from app.services.extraction import unverified_citations
from app.services.legal_search import (
    BM25Retriever,
    Provision,
    default_retriever,
    expand_query,
    get_provision,
    load_provisions,
    search_case,
    stem,
)


def test_corpus_loads_with_unique_ids_and_text():
    provisions = load_provisions()
    assert len(provisions) >= 50
    assert len({p.id for p in provisions}) == len(provisions)
    assert all(p.text and p.url.startswith("https://www.legislation.gov.uk/") for p in provisions)


def test_limitation_section_text():
    s5 = get_provision("ukpga/1980/58/section/5")
    assert s5 is not None
    assert "six years" in s5.text


def test_stemming_groups_word_forms():
    assert stem("defects") == stem("defect")
    assert stem("deliveries") == "delivery"


def test_expansion_maps_lay_terms_to_statutory_language():
    assert "satisfactory quality" in expand_query("the tiles arrived cracked")
    assert "statutory interest" in expand_query("they have not paid our invoice")
    assert "reasonableness" in expand_query("the contract caps their liability")
    assert expand_query("a sentence with no trigger words") == "a sentence with no trigger words"


def top_ids(query: str, k: int = 5, expand: bool = True) -> list[str]:
    return [h.provision.id for h in default_retriever().search(query, k=k, expand=expand)]


def test_search_quality_examples():
    assert "ukpga/1979/54/section/14" in top_ids("the worktops were defective and cracked")
    assert "ukpga/1979/54/section/51" in top_ids("we paid in advance and the goods never arrived")
    assert "ukpga/1982/29/section/15" in top_ids("work done at our usual rates, price never agreed")
    assert any(i.startswith("ukpga/1977/50/") for i in top_ids("they capped their liability"))


def test_search_case_led_by_description():
    docs = [
        Provision("quality", "Act A", "1", "Quality of goods", "defective goods quality", "u"),
        Provision("hire", "Act B", "2", "Hire of scaffolding", "scaffolding hire period", "u"),
    ]
    r = BM25Retriever(docs)
    hits = search_case("the goods were defective", ["scaffolding hire agreement"], k=2, retriever=r)
    assert [h.provision.id for h in hits] == ["quality", "hire"]
    assert hits[0].score > hits[1].score


def test_search_case_without_documents():
    hits = search_case("the goods never arrived", [], k=3)
    assert hits and hits[0].provision.id == "ukpga/1979/54/section/51"


def test_search_returns_nothing_for_unrelated_query():
    assert default_retriever().search("zzzz qqqq") == []


def test_bm25_prefers_matching_title():
    docs = [
        Provision("a", "Act A", "1", "Delivery of goods", "Rules apply.", "u"),
        Provision("b", "Act B", "2", "Payment", "Delivery is mentioned once here.", "u"),
    ]
    hits = BM25Retriever(docs).search("delivery", expand=False)
    assert hits[0].provision.id == "a"


def test_unverified_citations():
    s5 = get_provision("ukpga/1980/58/section/5")
    facts = ExtractedFacts(
        parties=[],
        facts=[],
        legal_issues=[
            LegalIssue(issue="ok", provision_id=s5.id, quote="shall not be brought after the expiration of six years"),
            LegalIssue(issue="wrong quote", provision_id=s5.id, quote="twelve years"),
            LegalIssue(issue="not provided", provision_id="ukpga/1979/54/section/14", quote="satisfactory quality"),
        ],
        open_questions=[],
    )
    assert unverified_citations(facts, [s5]) == [s5.id, "ukpga/1979/54/section/14"]


def test_curly_quotes_still_verify():
    p = Provision("x", "Act", "1", "T", "the “reasonableness” test", "u")
    facts = ExtractedFacts(
        parties=[], facts=[], open_questions=[],
        legal_issues=[LegalIssue(issue="i", provision_id="x", quote='the "reasonableness" test')],
    )
    assert unverified_citations(facts, [p]) == []


def test_search_endpoint(client):
    r = client.get("/legislation/search", params={"q": "goods never delivered", "k": 3})
    assert r.status_code == 200
    hits = r.json()
    assert 1 <= len(hits) <= 3
    assert {"id", "citation", "title", "url", "score", "text"} <= hits[0].keys()
    assert client.get("/legislation/search", params={"q": "x"}).status_code == 422
    assert client.get("/legislation/stats").json()["provisions"] >= 50
