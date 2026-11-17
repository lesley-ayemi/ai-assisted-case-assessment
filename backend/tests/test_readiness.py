from datetime import date

from app.schemas import Element, ExtractedFact, ExtractedFacts, SourceRef
from app.services.readiness import limitation_flags, score_readiness


def fact(element: Element) -> ExtractedFact:
    return ExtractedFact(
        statement="x", element=element, source=SourceRef(document_id=0, quote="x")
    )


def test_empty_facts_score_zero():
    report = score_readiness(ExtractedFacts(parties=[], facts=[], open_questions=[]), None)
    assert report.score == 0
    assert set(report.missing) == set(Element)


def test_fully_supported_scores_100():
    facts = [fact(e) for e in Element for _ in range(2)]
    report = score_readiness(
        ExtractedFacts(parties=[], facts=facts, open_questions=[]),
        breach_date=date(2025, 1, 1),
        today=date(2026, 1, 1),
    )
    assert report.score == 100
    assert report.flags == []


def test_single_fact_is_weak_half_credit():
    report = score_readiness(
        ExtractedFacts(parties=[], facts=[fact(Element.BREACH)], open_questions=[]), None
    )
    breach = next(e for e in report.elements if e.element == Element.BREACH)
    assert breach.status == "weak"
    assert report.score == round(0.25 * 0.5 * 100)


def test_limitation_expired():
    flags = limitation_flags(date(2019, 3, 1), today=date(2026, 1, 1))
    assert "expired" in flags[0]


def test_limitation_close_to_expiry():
    flags = limitation_flags(date(2020, 4, 1), today=date(2026, 1, 1))
    assert "expires on 2026-04-01" in flags[0]


def test_limitation_unknown_breach_date():
    assert "unknown" in limitation_flags(None, today=date(2026, 1, 1))[0]
