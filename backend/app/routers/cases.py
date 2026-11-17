from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Assessment, Case, Document
from app.schemas import (
    AssessmentOut,
    CaseCreate,
    CaseOut,
    DocumentOut,
    ReviewDecision,
)
from app.services import extraction
from app.services.documents import UnsupportedDocument, extract_text
from app.services.readiness import score_readiness

router = APIRouter(prefix="/cases", tags=["cases"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def _get_case(db: Session, case_id: int) -> Case:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    return case


@router.post("", response_model=CaseOut, status_code=201)
def create_case(body: CaseCreate, db: Session = Depends(get_db)):
    case = Case(**body.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("", response_model=list[CaseOut])
def list_cases(db: Session = Depends(get_db)):
    return db.scalars(select(Case).order_by(Case.created_at.desc())).all()


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: int, db: Session = Depends(get_db)):
    return _get_case(db, case_id)


@router.post("/{case_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(case_id: int, file: UploadFile, db: Session = Depends(get_db)):
    case = _get_case(db, case_id)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (20 MB max)")
    try:
        text, pages = extract_text(data, file.content_type or "", file.filename or "")
    except UnsupportedDocument as e:
        raise HTTPException(415, str(e)) from e
    doc = Document(
        case=case,
        filename=file.filename or "upload",
        content_type=file.content_type or "",
        text=text,
        page_count=pages,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{case_id}/assessments", response_model=AssessmentOut, status_code=201)
def run_assessment(case_id: int, db: Session = Depends(get_db)):
    case = _get_case(db, case_id)
    docs = [(d.id, d.filename, d.text) for d in case.documents]
    try:
        facts = extraction.extract_facts(case.description, docs)
    except extraction.ExtractionRefused as e:
        raise HTTPException(422, str(e)) from e
    readiness = score_readiness(facts, case.breach_date)
    assessment = Assessment(
        case=case,
        facts=facts.model_dump(mode="json"),
        readiness=readiness.model_dump(mode="json"),
        model=settings.llm_model,
    )
    case.status = "awaiting_review"
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/{case_id}/assessments", response_model=list[AssessmentOut])
def list_assessments(case_id: int, db: Session = Depends(get_db)):
    return _get_case(db, case_id).assessments


@router.post("/{case_id}/assessments/{assessment_id}/review", response_model=AssessmentOut)
def review_assessment(
    case_id: int, assessment_id: int, body: ReviewDecision, db: Session = Depends(get_db)
):
    assessment = db.get(Assessment, assessment_id)
    if assessment is None or assessment.case_id != case_id:
        raise HTTPException(404, "Assessment not found")
    if assessment.review_status != "pending":
        raise HTTPException(409, "Assessment already reviewed")
    assessment.review_status = body.decision
    assessment.reviewer_note = body.note
    assessment.reviewed_at = datetime.now(UTC)
    assessment.case.status = "reviewed"
    db.commit()
    db.refresh(assessment)
    return assessment
