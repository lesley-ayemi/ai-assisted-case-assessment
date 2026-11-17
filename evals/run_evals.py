"""Score fact extraction + readiness against hand-labelled fictional cases.

Usage (from repo root, with backend venv active and ANTHROPIC_API_KEY set):
    python evals/run_evals.py            # all cases
    python evals/run_evals.py 02         # cases whose folder starts with "02"

Each run calls the model once per case and costs real API credit.
Results are written to evals/results/<timestamp>.json so you can track progress over time.
"""

import json
import sys
import time
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from app.services.extraction import extract_facts, unverified_quotes
from app.services.readiness import score_readiness


def load_case(folder: Path):
    spec = json.loads((folder / "case.json").read_text())
    docs = [(i + 1, name, (folder / name).read_text()) for i, name in enumerate(spec["documents"])]
    return spec, docs


def run_case(folder: Path) -> dict:
    spec, docs = load_case(folder)
    exp = spec["expected"]
    started = time.perf_counter()
    facts = extract_facts(spec["description"], docs)
    elapsed = time.perf_counter() - started
    breach = date.fromisoformat(spec["breach_date"]) if spec.get("breach_date") else None
    report = score_readiness(facts, breach)

    status = {e.element.value: e.status for e in report.elements}
    all_text = " ".join(f.statement + " " + f.source.quote for f in facts.facts)
    bad_quotes = unverified_quotes(facts, spec["description"], docs)
    lo, hi = exp["score_range"]

    checks = {
        "quotes_verified": not bad_quotes,
        "score_in_range": lo <= report.score <= hi,
        **{f"found:{e}": status[e] != "missing" for e in exp.get("elements_supported", [])},
        **{f"absent:{e}": status[e] == "missing" for e in exp.get("elements_missing", [])},
        **{f"mentions:{m}": m in all_text for m in exp.get("must_mention", [])},
        **{
            f"flag:{f}": any(f in flag for flag in report.flags)
            for f in exp.get("flags_should_include", [])
        },
    }
    return {
        "case": folder.name,
        "passed": sum(checks.values()),
        "total": len(checks),
        "checks": checks,
        "score": report.score,
        "fact_count": len(facts.facts),
        "unverified_quotes": bad_quotes,
        "seconds": round(elapsed, 1),
    }


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else ""
    folders = sorted(p for p in (ROOT / "cases").iterdir() if p.is_dir() and p.name.startswith(prefix))
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
    bad = sum(len(r["unverified_quotes"]) for r in results)
    print(f"\nOverall: {passed}/{total} checks ({passed / max(total, 1):.0%})")
    print(f"Quote verification: {facts - bad}/{facts} facts traceable to source")

    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    path = out / f"{datetime.now():%Y%m%d-%H%M%S}.json"
    path.write_text(json.dumps(results, indent=2))
    print(f"Saved {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
