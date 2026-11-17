"""Evidence-readiness score.

Deliberately deterministic and explainable: it measures how well the extracted facts
cover each element of a breach-of-contract claim. It is NOT a prediction of outcome.
"""

from datetime import date

from app.schemas import Element, ElementScore, ExtractedFacts, ReadinessReport

WEIGHTS: dict[Element, float] = {
    Element.CONTRACT_FORMED: 0.20,
    Element.TERMS_IDENTIFIED: 0.15,
    Element.BREACH: 0.25,
    Element.LOSS: 0.20,
    Element.CAUSATION: 0.10,
    Element.PRE_ACTION: 0.10,
}

# One supporting fact counts as "weak"; two or more independent ones as "supported".
SUPPORTED_THRESHOLD = 2

# Limitation Act 1980 s.5: six years from breach for simple contracts.
LIMITATION_PROVISION_ID = "ukpga/1980/58/section/5"
LIMITATION_CITATION = "Limitation Act 1980, s.5"
LIMITATION_YEARS = 6
LIMITATION_WARNING_MONTHS = 6


def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year + years, day=28)


def limitation_flags(breach_date: date | None, today: date) -> list[str]:
    if breach_date is None:
        return [f"Breach date unknown: limitation period cannot be checked ({LIMITATION_CITATION})."]
    expiry = _add_years(breach_date, LIMITATION_YEARS)
    if today >= expiry:
        message = (
            f"Limitation period appears to have expired on {expiry.isoformat()} "
            f"({LIMITATION_CITATION}). Check for acknowledgment, part payment or concealment."
        )
        return [message]
    months_left = (expiry.year - today.year) * 12 + (expiry.month - today.month)
    if months_left <= LIMITATION_WARNING_MONTHS:
        message = (
            f"Limitation period expires on {expiry.isoformat()} (about {months_left} months; "
            f"{LIMITATION_CITATION})."
        )
        return [message]
    return []


def score_readiness(
    extracted: ExtractedFacts, breach_date: date | None, today: date | None = None
) -> ReadinessReport:
    today = today or date.today()
    counts = {e: 0 for e in Element}
    for fact in extracted.facts:
        counts[fact.element] += 1

    elements: list[ElementScore] = []
    total = 0.0
    for element, weight in WEIGHTS.items():
        n = counts[element]
        if n >= SUPPORTED_THRESHOLD:
            status, credit = "supported", 1.0
        elif n == 1:
            status, credit = "weak", 0.5
        else:
            status, credit = "missing", 0.0
        total += weight * credit
        elements.append(ElementScore(element=element, status=status, fact_count=n, weight=weight))

    return ReadinessReport(
        score=round(total * 100),
        elements=elements,
        flags=limitation_flags(breach_date, today),
        missing=[e.element for e in elements if e.status == "missing"],
    )
