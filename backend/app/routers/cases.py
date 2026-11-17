import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
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
    ProvisionRef,
    ReviewDecision,
    Verification,
)
from app.services import extraction
from app.services.documents import UnsupportedDocument, extract_text
from app.services.legal_search import get_provision, search_case
from app.services.readiness import LIMITATION_PROVISION_ID, score_readiness
from app.services.report import build_report_pdf

router = APIRouter(prefix="/cases", tags=["cases"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
PROVISIONS_PER_ASSESSMENT = 6


def _get_case(db: Session, case_id: int) -> Case:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    return case


def _get_assessment(db: Session, case_id: int, assessment_id: int) -> Assessment:
    assessment = db.get(Assessment, assessment_id)
    if assessment is None or assessment.case_id != case_id:
        raise HTTPException(404, "Assessment not found")
    return assessment


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

    hits = search_case(case.description, [text for _, _, text in docs], k=PROVISIONS_PER_ASSESSMENT)
    provisions = [h.provision for h in hits]

    try:
        facts = extraction.extract_facts(case.description, docs, provisions)
    except extraction.ExtractionRefused as e:
        raise HTTPException(422, str(e)) from e

    sources = [
        ProvisionRef(id=h.provision.id, citation=h.provision.citation, title=h.provision.title,
                     url=h.provision.url, via="search", score=h.score)
        for h in hits
    ]
    limitation = get_provision(LIMITATION_PROVISION_ID)
    if limitation and limitation.id not in {s.id for s in sources}:
        sources.append(ProvisionRef(id=limitation.id, citation=limitation.citation,
                                    title=limitation.title, url=limitation.url, via="rule"))
    verification = Verification(
        unverified_quotes=extraction.unverified_quotes(facts, case.description, docs),
        unverified_citations=extraction.unverified_citations(facts, provisions),
    )
    readiness = score_readiness(facts, case.breach_date,
                                unverified_quotes=verification.unverified_quotes)

    assessment = Assessment(
        case=case,
        facts=facts.model_dump(mode="json"),
        readiness=readiness.model_dump(mode="json"),
        sources=[s.model_dump(mode="json") for s in sources],
        verification=verification.model_dump(mode="json"),
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
    assessment = _get_assessment(db, case_id, assessment_id)
    if assessment.review_status != "pending":
        raise HTTPException(409, "Assessment already reviewed")
    assessment.review_status = body.decision
    assessment.reviewer_note = body.note
    assessment.reviewed_at = datetime.now(UTC)
    assessment.case.status = "reviewed"
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get(
    "/{case_id}/assessments/{assessment_id}/report.pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def download_report(case_id: int, assessment_id: int, db: Session = Depends(get_db)):
    assessment = _get_assessment(db, case_id, assessment_id)
    pdf = build_report_pdf(assessment.case, assessment)
    slug = re.sub(r"[^a-z0-9]+", "-", assessment.case.title.lower()).strip("-")[:60] or "case"
    filename = f"assessment-{assessment.id}-{slug}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
