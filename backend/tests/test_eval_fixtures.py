"""Sanity-check the hand-labelled eval cases so a typo can't silently break the eval."""

import json
from pathlib import Path

import pytest

from app.schemas import Element

CASES = sorted((Path(__file__).resolve().parents[2] / "evals" / "cases").iterdir())
ELEMENTS = {e.value for e in Element}


@pytest.mark.parametrize("folder", CASES, ids=lambda p: p.name)
def test_fixture_is_well_formed(folder: Path):
    spec = json.loads((folder / "case.json").read_text())
    exp = spec["expected"]
    corpus = spec["description"] + "".join((folder / d).read_text() for d in spec["documents"])

    for el in exp.get("elements_supported", []) + exp.get("elements_missing", []):
        assert el in ELEMENTS, f"unknown element {el}"
    for phrase in exp.get("must_mention", []):
        assert phrase in corpus, f"'{phrase}' never appears in the source material"
    lo, hi = exp["score_range"]
    assert 0 <= lo < hi <= 100
