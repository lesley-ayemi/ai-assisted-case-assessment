"""Evaluate the case assessment pipeline against hand-labelled fictional cases.

Usage (from repo root):
    backend/.venv/bin/python evals/run_evals.py --retrieval-only   # offline, free
    backend/.venv/bin/python evals/run_evals.py                    # full run, calls the model
    backend/.venv/bin/python evals/run_evals.py 02                 # cases starting with "02"

The full run calls the model once per case and costs API credit (needs ANTHROPIC_API_KEY).
Results are written to evals/results/<timestamp>.json so you can track progress over time.
"""

import argparse
import json
import sys
import time
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from app.routers.cases import PROVISIONS_PER_ASSESSMENT
from app.services.legal_search import search_case
from app.services.readiness import score_readiness

K = PROVISIONS_PER_ASSESSMENT


def load_case(folder: Path):
    spec = json.loads((folder / "case.json").read_text())
    docs = [(i + 1, name, (folder / name).read_text()) for i, name in enumerate(spec["documents"])]
    return spec, docs


def retrieve(spec: dict, docs, expand: bool = True):
    return search_case(spec["description"], [text for _, _, text in docs], k=K, expand=expand)


# ---------- Retrieval (offline) ----------


def retrieval_metrics(folders: list[Path], expand: bool) -> dict:
    found = total = 0
    reciprocal_ranks = []
    misses = []
    for folder in folders:
        spec, docs = load_case(folder)
        expected = spec["expected"].get("provisions")
        if not expected:
            continue
        ranked = [h.provision.id for h in retrieve(spec, docs, expand)]
        for pid in expected:
            total += 1
            if pid in ranked:
                found += 1
                reciprocal_ranks.append(1 / (ranked.index(pid) + 1))
            else:
                reciprocal_ranks.append(0.0)
                misses.append(f"{folder.name}: {pid}")
    return {
        "labels": total,
        f"recall@{K}": round(found / max(total, 1), 3),
        "mrr": round(sum(reciprocal_ranks) / max(len(reciprocal_ranks), 1), 3),
        "misses": misses,
    }


def run_retrieval(folders: list[Path]) -> dict:
    with_exp = retrieval_metrics(folders, expand=True)
    without = retrieval_metrics(folders, expand=False)
    print(f"Retrieval over {with_exp['labels']} labelled provisions (top {K})")
    print(f"  {'':<22}{'recall@' + str(K):>10}{'MRR':>8}")
    print(f"  {'BM25 + expansion':<22}{with_exp[f'recall@{K}']:>10.0%}{with_exp['mrr']:>8.2f}")
    print(f"  {'BM25 only':<22}{without[f'recall@{K}']:>10.0%}{without['mrr']:>8.2f}")
    for miss in with_exp["misses"]:
        print(f"    MISS {miss}")
    return {"with_expansion": with_exp, "without_expansion": without}


# ---------- Full pipeline (calls the model) ----------


def run_case(folder: Path) -> dict:
    from app.services.extraction import extract_facts, unverified_citations, unverified_quotes

    spec, docs = load_case(folder)
    exp = spec["expected"]
    provisions = [h.provision for h in retrieve(spec, docs)]

    started = time.perf_counter()
    facts = extract_facts(spec["description"], docs, provisions)
    elapsed = time.perf_counter() - started

    breach = date.fromisoformat(spec["breach_date"]) if spec.get("breach_date") else None
    report = score_readiness(facts, breach, today=date.fromisoformat(spec["as_of"]))

    status = {e.element.value: e.status for e in report.elements}
    all_text = " ".join(f.statement + " " + f.source.quote for f in facts.facts)
    bad_quotes = unverified_quotes(facts, spec["description"], docs)
    bad_citations = unverified_citations(facts, provisions)
    cited = {i.provision_id for i in facts.legal_issues}
    lo, hi = exp["score_range"]

    checks = {
        "quotes_verified": not bad_quotes,
        "citations_verified": not bad_citations,
        "score_in_range": lo <= report.score <= hi,
        **{f"found:{e}": status[e] != "missing" for e in exp.get("elements_supported", [])},
        **{f"absent:{e}": status[e] == "missing" for e in exp.get("elements_missing", [])},
        **{f"mentions:{m}": m in all_text for m in exp.get("must_mention", [])},
        **{
            f"flag:{f}": any(f in flag for flag in report.flags)
            for f in exp.get("flags_should_include", [])
        },
        **{f"cited:{p}": p in cited for p in exp.get("provisions", [])},
    }
    return {
        "case": folder.name,
        "passed": sum(checks.values()),
        "total": len(checks),
        "checks": checks,
        "score": report.score,
        "fact_count": len(facts.facts),
        "citation_count": len(facts.legal_issues),
        "unverified_quotes": bad_quotes,
        "unverified_citations": bad_citations,
        "seconds": round(elapsed, 1),
    }


def run_full(folders: list[Path]) -> list[dict]:
    results = []
    for folder in folders:
        r = run_case(folder)
        results.append(r)
        print(f"{r['case']:<32} {r['passed']}/{r['total']} checks  score={r['score']:>3}  {r['seconds']}s")
        for name, ok in r["checks"].items():
            if not ok:
                print(f"    FAIL {name}")

    passed = sum(r["passed"] for r in results)
    total = sum(r["total"] for r in results)
    facts = sum(r["fact_count"] for r in results)
    bad_q = sum(len(r["unverified_quotes"]) for r in results)
    cites = sum(r["citation_count"] for r in results)
    bad_c = sum(len(r["unverified_citations"]) for r in results)
    print(f"\nOverall: {passed}/{total} checks ({passed / max(total, 1):.0%})")
    print(f"Quote verification: {facts - bad_q}/{facts} facts traceable to source")
    print(f"Citation verification: {cites - bad_c}/{cites} citations verified against statute text")
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("prefix", nargs="?", default="", help="only run cases whose folder starts with this")
    parser.add_argument("--retrieval-only", action="store_true", help="offline retrieval eval, no API calls")
    args = parser.parse_args()

    folders = sorted(p for p in (ROOT / "cases").iterdir() if p.is_dir() and p.name.startswith(args.prefix))
    output = {"retrieval": run_retrieval(folders)}
    if not args.retrieval_only:
        print()
        output["cases"] = run_full(folders)

    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    path = out / f"{datetime.now():%Y%m%d-%H%M%S}{'-retrieval' if args.retrieval_only else ''}.json"
    path.write_text(json.dumps(output, indent=2))
    print(f"Saved {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
