"""LLM fact extraction with source references and statutory citations."""

import anthropic

from app.config import settings
from app.schemas import ExtractedFacts
from app.services.legal_search import Provision

SYSTEM_PROMPT = """\
You assist a solicitor in England and Wales with a preliminary review of a contract dispute.
Extract facts from the client's description and the supporting documents, and note which of
the provided statutory provisions may be relevant.

Rules:
- Only state facts the material supports. Every fact needs a source: the document_id and a
  short verbatim quote. Facts from the client's description use document_id 0.
- Tag each fact with the claim element it evidences: contract_formed, terms_identified,
  breach, loss, causation, or pre_action (letters before claim, pre-action correspondence).
- Legal issues may cite only the <provision> elements provided, by their exact id, with a
  short verbatim quote from that provision. The provisions were found by keyword search and
  some may be irrelevant: leave those out. Do not cite case law or any other source.
- Do not assess who will win. Do not give legal advice.
- List what a solicitor would still need to confirm under open_questions.
"""


class ExtractionRefused(RuntimeError):
    pass


def build_user_content(
    description: str, documents: list[tuple[int, str, str]], provisions: list[Provision]
) -> str:
    parts = [f'<document id="0" name="client description">\n{description}\n</document>']
    for doc_id, filename, text in documents:
        parts.append(f'<document id="{doc_id}" name="{filename}">\n{text}\n</document>')
    for p in provisions:
        parts.append(
            f'<provision id="{p.id}" citation="{p.citation}" title="{p.title}">\n{p.text}\n</provision>'
        )
    return "\n\n".join(parts)


def extract_facts(
    description: str,
    documents: list[tuple[int, str, str]],
    provisions: list[Provision] | None = None,
    client: anthropic.Anthropic | None = None,
) -> ExtractedFacts:
    client = client or anthropic.Anthropic()
    content = build_user_content(description, documents, provisions or [])
    response = client.beta.messages.parse(
        model=settings.llm_model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
        output_format=ExtractedFacts,
        output_config={"effort": settings.llm_effort},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise ExtractionRefused("The model declined to process this case material.")
    if response.parsed_output is None:
        raise RuntimeError(f"No structured output (stop_reason={response.stop_reason})")
    return response.parsed_output


def unverified_quotes(
    extracted: ExtractedFacts, description: str, documents: list[tuple[int, str, str]]
) -> list[str]:
    """Return quotes that do not appear verbatim in their cited document (hallucination check)."""
    texts = {0: description, **{doc_id: text for doc_id, _, text in documents}}
    bad = []
    for fact in extracted.facts:
        source = texts.get(fact.source.document_id)
        if source is None or _norm(fact.source.quote) not in _norm(source):
            bad.append(fact.source.quote)
    return bad


def unverified_citations(extracted: ExtractedFacts, provisions: list[Provision]) -> list[str]:
    """Return citations to provisions that were not provided, or whose quote is not in the text."""
    texts = {p.id: p.text for p in provisions}
    bad = []
    for issue in extracted.legal_issues:
        source = texts.get(issue.provision_id)
        if source is None or _norm(issue.quote) not in _norm(source):
            bad.append(issue.provision_id)
    return bad


def _norm(s: str) -> str:
    # Statutes use curly quotes; models often emit straight ones.
    s = s.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    return " ".join(s.split()).lower()
