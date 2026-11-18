from fastapi import APIRouter, HTTPException, Query

from app.schemas import ProvisionHit, ProvisionOut, QueryExpansion
from app.services.legal_search import (
    default_retriever,
    expand_query,
    explain_expansion,
    get_provision,
    load_provisions,
    tokenize,
)

router = APIRouter(prefix="/legislation", tags=["legislation"])


@router.get("/search", response_model=list[ProvisionHit])
def search(q: str = Query(min_length=2, max_length=2000), k: int = Query(5, ge=1, le=20)):
    terms = set(tokenize(expand_query(q)))
    return [
        ProvisionHit(
            id=h.provision.id,
            citation=h.provision.citation,
            title=h.provision.title,
            url=h.provision.url,
            score=h.score,
            text=h.provision.text,
            matched=sorted(terms & set(tokenize(f"{h.provision.title} {h.provision.text}"))),
        )
        for h in default_retriever().search(q, k=k)
    ]


@router.get("/expand", response_model=list[QueryExpansion])
def expand(q: str = Query(min_length=2, max_length=2000)):
    """How a plain-English query is widened with statutory terms before searching."""
    return [QueryExpansion(matched=m, terms=t) for m, t in explain_expansion(q)]


@router.get("/stats")
def stats():
    provisions = load_provisions()
    counts: dict[str, int] = {}
    for p in provisions:
        counts[p.act] = counts.get(p.act, 0) + 1
    return {
        "provisions": len(provisions),
        "acts": sorted(counts),
        "sections_per_act": dict(sorted(counts.items())),
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
