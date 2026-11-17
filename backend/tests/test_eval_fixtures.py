"""Sanity-check the hand-labelled eval cases so a typo can't silently break the eval."""

import json
from datetime import date
from pathlib import Path

import pytest

from app.schemas import Element
from app.services.readiness import limitation_flags

CASES_DIR = Path(__file__).resolve().parents[2] / "evals" / "cases"
CASES = sorted(p for p in CASES_DIR.iterdir() if p.is_dir())
ELEMENTS = {e.value for e in Element}
KNOWN_EXPECTED_KEYS = {
    "elements_supported",
    "elements_missing",
    "must_mention",
    "flags_should_include",
    "score_range",
}


def load(folder: Path) -> dict:
    return json.loads((folder / "case.json").read_text())


def test_at_least_twenty_cases():
    assert len(CASES) >= 20


def test_case_numbers_are_unique():
    prefixes = [p.name.split("-")[0] for p in CASES]
    assert len(prefixes) == len(set(prefixes))


@pytest.mark.parametrize("folder", CASES, ids=lambda p: p.name)
def test_fixture_is_well_formed(folder: Path):
    spec = load(folder)
    exp = spec["expected"]
    assert set(exp) <= KNOWN_EXPECTED_KEYS, f"unscored keys: {set(exp) - KNOWN_EXPECTED_KEYS}"

    for name in spec["documents"]:
        assert (folder / name).is_file(), f"missing document {name}"
    corpus = spec["description"] + "".join((folder / d).read_text() for d in spec["documents"])

    supported = set(exp.get("elements_supported", []))
    missing = set(exp.get("elements_missing", []))
    assert supported | missing <= ELEMENTS, f"unknown elements {(supported | missing) - ELEMENTS}"
    assert not supported & missing, f"element both supported and missing: {supported & missing}"

    for phrase in exp.get("must_mention", []):
        assert phrase in corpus, f"'{phrase}' never appears in the source material"

    lo, hi = exp["score_range"]
    assert 0 <= lo < hi <= 100


@pytest.mark.parametrize("folder", CASES, ids=lambda p: p.name)
def test_expected_limitation_flags_match_rules(folder: Path):
    """Limitation flags are deterministic, so the labels can be checked without the model."""
    spec = load(folder)
    breach = date.fromisoformat(spec["breach_date"]) if spec["breach_date"] else None
    flags = limitation_flags(breach, today=date.fromisoformat(spec["as_of"]))
    for expected in spec["expected"].get("flags_should_include", []):
        assert any(expected in f for f in flags), f"'{expected}' not in {flags}"
    if not spec["expected"].get("flags_should_include"):
        assert flags == [], f"unlabelled limitation flag fired: {flags}"
