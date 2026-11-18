"""Retrieval over statutory provisions from legislation.gov.uk.

BM25 keyword search with a small, hand-written query expansion that maps everyday
descriptions ("cracked", "unpaid invoice") onto statutory language ("satisfactory
quality", "qualifying debt"). Callers depend on the `Retriever` protocol so a vector
or hybrid retriever can be swapped in later without touching them.
"""

import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

CORPUS_PATH = Path(__file__).resolve().parents[2] / "data" / "legislation" / "sections.json"

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from", "has", "have",
    "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "of", "on", "or", "our",
    "shall", "she", "so", "such", "than", "that", "the", "their", "them", "then", "there",
    "these", "they", "this", "to", "under", "was", "we", "were", "which", "who", "will",
    "with", "would", "you", "your", "any", "all", "not", "no", "may", "other",
    "section", "subsection", "act",
}  # fmt: skip

# Lay phrasing -> statutory vocabulary. Written from general knowledge of contract
# disputes, not tuned per eval case; the retrieval eval reports results with and without it.
EXPANSIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(p, re.IGNORECASE), terms)
    for p, terms in [
        (r"\b(unpaid|overdue|outstanding|not (been )?paid|refused to pay|invoice[sd]?)\b",
         "statutory interest qualifying debt late payment commercial debts price"),
        (r"\b(defect\w*|crack\w*|faulty|broken|damaged|substandard|not fit)\b",
         "satisfactory quality fitness purpose defects"),
        (r"\b(reject\w*|send (them|it) back)\b", "rejection acceptance partial rejection"),
        (r"\b(never (arrived|delivered)|not delivered|nothing arrived|failed to deliver)\b",
         "non-delivery delivery damages"),
        ((r"\b(liability (cap|limit)\w*|exclusion clause|"
          r"(cap|limit|restrict|exclu)\w*\b[^.]{0,25}\bliabilit\w*)"),
         "exclude restrict liability reasonableness contract term"),
        (r"\b(misled|misrepresent\w*|false statement|lied)\b", "misrepresentation"),
        (r"\b(late delivery|delay\w*|missed (the )?deadline|go-live)\b", "time for performance"),
        (r"\b(usual rates|day rates|no (agreed|fixed) price|price (was )?never agreed)\b",
         "consideration reasonable charge price not determined"),
        (r"\b(best endeavours|poor workmanship|negligen\w*|careless\w*|incompetent\w*)\b",
         "care and skill"),
        (r"\b(third part(y|ies)|beneficiar\w*)\b", "third party enforce term"),
    ]
]

_SUFFIXES = ("ations", "ation", "ments", "ment", "ings", "ing", "ness", "ies", "ied", "es", "ed", "ly", "s")


def stem(word: str) -> str:
    for suffix in _SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            base = word[: -len(suffix)]
            return base + "y" if suffix in ("ies", "ied") else base
    return word


def tokenize(text: str) -> list[str]:
    return [stem(w) for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOPWORDS]


def expand_query(query: str) -> str:
    extra = [terms for pattern, terms in EXPANSIONS if pattern.search(query)]
    return " ".join([query, *extra])


def explain_expansion(query: str) -> list[tuple[str, str]]:
    """The everyday phrases found in a query and the statutory terms each one adds."""
    return [(m.group(0), terms) for pattern, terms in EXPANSIONS if (m := pattern.search(query))]


@dataclass(frozen=True)
class Provision:
    id: str
    act: str
    section: str
    title: str
    text: str
    url: str

    @property
    def citation(self) -> str:
        return f"{self.act}, s.{self.section}"


@dataclass(frozen=True)
class Hit:
    provision: Provision
    score: float


class Retriever(Protocol):
    def search(self, query: str, k: int = 5) -> list[Hit]: ...


class BM25Retriever:
    def __init__(self, provisions: list[Provision], k1: float = 1.5, b: float = 0.75):
        self.provisions = provisions
        self.k1, self.b = k1, b
        # Title counted twice: it is a dense summary of the provision.
        self.docs = [
            Counter(tokenize(f"{p.act} {p.title} {p.title} {p.text}")) for p in provisions
        ]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avg_len = sum(self.lengths) / len(self.lengths)
        df = Counter(term for d in self.docs for term in d)
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def _score(self, terms: set[str], i: int) -> float:
        doc, length, score = self.docs[i], self.lengths[i], 0.0
        for t in terms:
            tf = doc.get(t)
            if tf:
                norm = tf + self.k1 * (1 - self.b + self.b * length / self.avg_len)
                score += self.idf[t] * tf * (self.k1 + 1) / norm
        return score

    def search(self, query: str, k: int = 5, expand: bool = True) -> list[Hit]:
        terms = set(tokenize(expand_query(query) if expand else query))
        scored = [(self._score(terms, i), i) for i in range(len(self.docs))]
        scored.sort(reverse=True)
        return [Hit(self.provisions[i], round(s, 3)) for s, i in scored[:k] if s > 0]


# Case retrieval: the client's description states the dispute, while uploaded documents add
# boilerplate (addresses, signatures, product codes) that drowns out the signal in one long
# query. So the description leads and documents are a secondary signal, combined with
# weighted reciprocal rank fusion. Measured in evals/run_evals.py --retrieval-only.
DOCUMENT_WEIGHT = 0.25
RRF_C = 60
CANDIDATES = 20


def search_case(
    description: str,
    document_texts: list[str],
    k: int = 6,
    expand: bool = True,
    retriever: BM25Retriever | None = None,
) -> list[Hit]:
    retriever = retriever or default_retriever()
    ranked_lists = [(retriever.search(description, CANDIDATES, expand), 1.0)]
    docs = "\n".join(t for t in document_texts if t.strip())
    if docs:
        ranked_lists.append((retriever.search(docs, CANDIDATES, expand), DOCUMENT_WEIGHT))

    fused: dict[str, float] = {}
    by_id: dict[str, Provision] = {}
    for hits, weight in ranked_lists:
        for rank, hit in enumerate(hits):
            by_id[hit.provision.id] = hit.provision
            fused[hit.provision.id] = fused.get(hit.provision.id, 0.0) + weight / (RRF_C + rank + 1)
    top = sorted(fused.items(), key=lambda item: item[1], reverse=True)[:k]
    # Scores are scaled so the best possible single-list match is 1.0.
    return [Hit(by_id[pid], round(score * (RRF_C + 1), 3)) for pid, score in top]


@lru_cache
def load_provisions(path: Path = CORPUS_PATH) -> tuple[Provision, ...]:
    data = json.loads(path.read_text())
    return tuple(Provision(**{f: s[f] for f in Provision.__dataclass_fields__}) for s in data["sections"])


@lru_cache
def default_retriever() -> BM25Retriever:
    return BM25Retriever(list(load_provisions()))


def get_provision(provision_id: str) -> Provision | None:
    return next((p for p in load_provisions() if p.id == provision_id), None)
