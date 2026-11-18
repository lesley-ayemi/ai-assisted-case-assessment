from fastapi import APIRouter, HTTPException, Query

from app.schemas import ProvisionHit, ProvisionOut
from app.services.legal_search import default_retriever, get_provision, load_provisions

router = APIRouter(prefix="/legislation", tags=["legislation"])


@router.get("/search", response_model=list[ProvisionHit])
def search(q: str = Query(min_length=2, max_length=2000), k: int = Query(5, ge=1, le=20)):
    return [
        ProvisionHit(
            id=h.provision.id,
            citation=h.provision.citation,
            title=h.provision.title,
            url=h.provision.url,
            score=h.score,
            text=h.provision.text,
        )
        for h in default_retriever().search(q, k=k)
    ]


@router.get("/stats")
def stats():
    provisions = load_provisions()
    return {
        "provisions": len(provisions),
        "acts": sorted({p.act for p in provisions}),
        "source": "legislation.gov.uk (Open Government Licence v3.0)",
    }


@router.get("/provisions/{provision_id:path}", response_model=ProvisionOut)
def provision(provision_id: str):
    """One provision's full text, by ID (for example ukpga/1979/54/section/14)."""
    p = get_provision(provision_id)
    if p is None:
        raise HTTPException(404, "Provision not found")
    return ProvisionOut(
        id=p.id, act=p.act, section=p.section, citation=p.citation, title=p.title, url=p.url, text=p.text
    )
