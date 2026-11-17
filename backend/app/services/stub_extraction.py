"""Deterministic stand-in for the LLM extractor, used for end-to-end tests and keyless demos.

Enabled only with LLM_PROVIDER=stub. It tags verbatim lines of the material by keyword, so
every quote passes verification; it does no real analysis. Assessments it produces record
the model as "stub".
"""

import re

from app.schemas import Element, ExtractedFact, ExtractedFacts, LegalIssue, SourceRef
from app.services.legal_search import Provision

STUB_MODEL = "stub"
MAX_FACTS_PER_ELEMENT = 3
MAX_QUOTE_CHARS = 200


def _rx(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


# First match wins, so the more specific patterns come first.
PATTERNS: list[tuple[Element, re.Pattern[str]]] = [
    (Element.LOSS, _rx(r"£\s?\d")),
    (Element.PRE_ACTION, _rx(r"letter before|reject|notice|demand")),
    (Element.CAUSATION, _rx(r"because|caused|due to|as a result|fault")),
    (Element.BREACH, _rx(r"fail|defect|crack|unpaid|not paid|refus|late|will not")),
    (Element.TERMS_IDENTIFIED, _rx(r"\bshall\b|\bmust\b|clause|\bterms?\b")),
    (Element.CONTRACT_FORMED, _rx(r"agreement|contract|purchase order|signed|ordered")),
]


def _lines(text: str) -> list[str]:
    parts = re.split(r"\n+|(?<=[.!?])\s+", text)
    return [p.strip()[:MAX_QUOTE_CHARS] for p in parts if len(p.strip()) > 8]


def extract_facts(
    description: str,
    documents: list[tuple[int, str, str]],
    provisions: list[Provision] | None = None,
) -> ExtractedFacts:
    counts = dict.fromkeys(Element, 0)
    facts: list[ExtractedFact] = []
    for doc_id, text in [(0, description), *((d, t) for d, _, t in documents)]:
        for line in _lines(text):
            element = next((e for e, rx in PATTERNS if rx.search(line)), None)
            if element is None or counts[element] >= MAX_FACTS_PER_ELEMENT:
                continue
            counts[element] += 1
            facts.append(ExtractedFact(
                statement=line, element=element,
                source=SourceRef(document_id=doc_id, quote=line),
            ))

    issues = [
        LegalIssue(
            issue=f"Retrieved by keyword search: check whether {p.title.lower()} applies.",
            provision_id=p.id,
            quote=" ".join(p.text.split()[:12]),
        )
        for p in (provisions or [])[:2]
    ]
    questions = [
        f"No evidence found for {e.value.replace('_', ' ')}: ask the client."
        for e, n in counts.items() if n == 0
    ]
    return ExtractedFacts(
        parties=[], facts=facts, legal_issues=issues,
        open_questions=questions or ["Confirm the facts above against the original documents."],
    )
