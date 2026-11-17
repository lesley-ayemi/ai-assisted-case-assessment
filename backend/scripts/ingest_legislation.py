"""Fetch selected statutory provisions from legislation.gov.uk and save them as JSON.

Run from backend/:  .venv/bin/python scripts/ingest_legislation.py

Source: legislation.gov.uk, Open Government Licence v3.0. Text is the latest revised
version on the day of fetching; it may not reflect amendments not yet incorporated.
"""

import json
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

BASE = "https://www.legislation.gov.uk"
NS = "{http://www.legislation.gov.uk/namespaces/legislation}"
OUT = Path(__file__).resolve().parents[1] / "data" / "legislation" / "sections.json"

# Provisions most often relevant to commercial contract disputes in England and Wales.
ACTS: dict[str, tuple[str, list[str]]] = {
    "ukpga/1980/58": ("Limitation Act 1980", ["5", "8", "28", "29", "30", "32"]),
    "ukpga/1979/54": (
        "Sale of Goods Act 1979",
        ["2", "8", "12", "13", "14", "15", "15A", "27", "28", "29", "30",
         "34", "35", "35A", "37", "49", "50", "51", "53", "54"],
    ),
    "ukpga/1982/29": (
        "Supply of Goods and Services Act 1982",
        ["2", "3", "4", "5", "12", "13", "14", "15", "16"],
    ),
    "ukpga/1998/20": (
        "Late Payment of Commercial Debts (Interest) Act 1998",
        ["1", "2", "3", "4", "5", "5A", "6", "8", "9"],
    ),
    "ukpga/1977/50": ("Unfair Contract Terms Act 1977", ["1", "2", "3", "6", "7", "11", "13"]),
    "ukpga/1967/7": ("Misrepresentation Act 1967", ["1", "2", "3"]),
    "ukpga/1999/31": ("Contracts (Rights of Third Parties) Act 1999", ["1", "2", "3"]),
}

SKIP = {"Commentary", "Commentaries", "CommentaryRef", "Pnumber", "Title"}
NUMBERED = {"P2", "P3", "P4", "P5"}


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def render(el: ET.Element) -> list[str]:
    """Flatten a provision into lines, keeping subsection numbers like (1), (a)."""
    lines: list[str] = []
    for child in el:
        tag = local(child.tag)
        if tag in SKIP:
            continue
        if tag in NUMBERED:
            num = child.find(f"{NS}Pnumber")
            label = f"({''.join(num.itertext()).strip()}) " if num is not None else ""
            body = " ".join(render(child))
            lines.append(f"{label}{body}".strip())
        elif tag == "Text":
            text = " ".join("".join(child.itertext()).split())
            if text:
                lines.append(text)
        else:
            lines.extend(render(child))
    return lines


def fetch(path: str) -> ET.Element:
    req = urllib.request.Request(f"{BASE}/{path}/data.xml", headers={"User-Agent": "legal-rag-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return ET.fromstring(resp.read())


def parse_section(root: ET.Element, act_path: str, section: str) -> dict:
    uri = f"http://www.legislation.gov.uk/{act_path}/section/{section}"
    p1 = next(el for el in root.iter(f"{NS}P1") if el.get("DocumentURI") == uri)
    group = next((g for g in root.iter(f"{NS}P1group") if p1 in list(g)), None)
    title_el = group.find(f"{NS}Title") if group is not None else None
    title = " ".join("".join(title_el.itertext()).split()).rstrip(".") if title_el is not None else ""
    text = "\n".join(render(p1))
    return {"title": title, "text": text}


def main():
    sections = []
    for act_path, (act_name, nums) in ACTS.items():
        for num in nums:
            path = f"{act_path}/section/{num}"
            try:
                parsed = parse_section(fetch(path), act_path, num)
            except (OSError, ET.ParseError, StopIteration) as e:  # network, bad XML, not found
                print(f"FAILED {path}: {e}")
                continue
            sections.append(
                {
                    "id": path,
                    "act": act_name,
                    "section": num,
                    "title": parsed["title"],
                    "text": parsed["text"],
                    "url": f"{BASE}/{path}",
                }
            )
            print(f"ok  {act_name} s.{num}: {parsed['title'][:60]}")
            time.sleep(0.5)  # be polite to the public API

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "source": "legislation.gov.uk",
                "licence": "Open Government Licence v3.0",
                "licence_url": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
                "retrieved": date.today().isoformat(),
                "sections": sections,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )
    print(f"\nSaved {len(sections)} sections to {OUT}")


if __name__ == "__main__":
    main()
