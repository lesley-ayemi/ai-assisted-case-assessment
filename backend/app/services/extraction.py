"""LLM fact extraction with source references."""

import anthropic

from app.config import settings
from app.schemas import ExtractedFacts

SYSTEM_PROMPT = """\
You assist a solicitor in England and Wales with a preliminary review of a contract dispute.
Extract facts from the client's description and the supporting documents.

Rules:
- Only state facts the material supports. Every fact needs a source: the document_id and a
  short verbatim quote. Facts from the client's description use document_id 0.
- Tag each fact with the claim element it evidences: contract_formed, terms_identified,
  breach, loss, causation, or pre_action (letters before claim, pre-action correspondence).
- Do not assess who will win. Do not give legal advice.
- List what a solicitor would still need to confirm under open_questions.
"""


class ExtractionRefused(RuntimeError):
    pass


def build_user_content(description: str, documents: list[tuple[int, str, str]]) -> str:
    parts = [f'<document id="0" name="client description">\n{description}\n</document>']
    for doc_id, filename, text in documents:
        parts.append(f'<document id="{doc_id}" name="{filename}">\n{text}\n</document>')
    return "\n\n".join(parts)


def extract_facts(
    description: str,
    documents: list[tuple[int, str, str]],
    client: anthropic.Anthropic | None = None,
) -> ExtractedFacts:
    client = client or anthropic.Anthropic()
    response = client.beta.messages.parse(
        model=settings.llm_model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_content(description, documents)}],
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
    norm = lambda s: " ".join(s.split()).lower()
    bad = []
    for fact in extracted.facts:
        source = texts.get(fact.source.document_id)
        if source is None or norm(fact.source.quote) not in norm(source):
            bad.append(fact.source.quote)
    return bad
