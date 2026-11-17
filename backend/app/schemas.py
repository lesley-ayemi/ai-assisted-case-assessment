from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------- Case intake ----------


class CaseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    client_name: str = Field(min_length=1, max_length=200)
    counterparty: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    breach_date: date | None = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    content_type: str
    page_count: int
    uploaded_at: datetime


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    client_name: str
    counterparty: str
    description: str
    breach_date: date | None
    status: str
    created_at: datetime
    documents: list[DocumentOut] = []


# ---------- Structured fact extraction (the LLM's output contract) ----------


class Element(str, Enum):
    """Elements a claimant must evidence in a breach-of-contract claim."""

    CONTRACT_FORMED = "contract_formed"
    TERMS_IDENTIFIED = "terms_identified"
    BREACH = "breach"
    LOSS = "loss"
    CAUSATION = "causation"
    PRE_ACTION = "pre_action"


class SourceRef(BaseModel):
    """Where in the uploaded material a fact came from. Every fact must carry one."""

    document_id: int
    quote: str = Field(description="Short verbatim quote from the document supporting the fact")


class ExtractedFact(BaseModel):
    statement: str
    element: Element
    source: SourceRef
    date: str | None = Field(default=None, description="ISO date if the fact has one")


class ExtractedFacts(BaseModel):
    parties: list[str]
    facts: list[ExtractedFact]
    open_questions: list[str] = Field(
        description="Facts a solicitor would need to confirm that the documents do not answer"
    )


# ---------- Readiness score ----------


class ElementScore(BaseModel):
    element: Element
    status: Literal["supported", "weak", "missing"]
    fact_count: int
    weight: float


class ReadinessReport(BaseModel):
    score: int = Field(ge=0, le=100)
    elements: list[ElementScore]
    flags: list[str]
    missing: list[Element]


# ---------- Review ----------


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    facts: ExtractedFacts
    readiness: ReadinessReport
    model: str
    review_status: str
    reviewer_note: str
    created_at: datetime
    reviewed_at: datetime | None


class ReviewDecision(BaseModel):
    decision: Literal["approved", "rejected", "amended"]
    note: str = ""
