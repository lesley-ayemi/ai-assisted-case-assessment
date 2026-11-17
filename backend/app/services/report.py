"""PDF export of an assessment, for the solicitor's file.

The report is built as HTML (a pure function, easy to test) and rendered to A4 with
PyMuPDF's Story API, which the app already uses for PDF text extraction.
"""

import io
from datetime import UTC, datetime
from html import escape

import pymupdf

from app.config import settings
from app.models import Assessment, Case
from app.schemas import AssessmentOut, Element

ELEMENT_LABELS = {
    Element.CONTRACT_FORMED: "Contract formed",
    Element.TERMS_IDENTIFIED: "Terms identified",
    Element.BREACH: "Breach",
    Element.LOSS: "Loss",
    Element.CAUSATION: "Causation",
    Element.PRE_ACTION: "Pre-action steps",
}

# Background fills are avoided throughout: PyMuPDF's Story repaints them on later pages.
STATUS_BANNERS = {
    "pending": ("DRAFT: NOT YET REVIEWED BY A SOLICITOR", "#b45309"),
    "rejected": ("REJECTED BY THE REVIEWING SOLICITOR", "#b91c1c"),
    "amended": ("APPROVED WITH AMENDMENTS: SEE REVIEWER NOTE", "#1d4ed8"),
    "approved": ("APPROVED BY THE REVIEWING SOLICITOR", "#047857"),
}

STATUS_COLOURS = {"supported": "#047857", "weak": "#b45309", "missing": "#b91c1c"}

CSS = """
body { font-family: sans-serif; font-size: 9.5pt; color: #0f172a; line-height: 1.35; }
h1 { font-size: 17pt; margin: 0 0 2pt 0; }
h2 { font-size: 12pt; margin: 14pt 0 5pt 0; padding-bottom: 2pt; border-bottom: 1px solid #cbd5e1; }
h3 { font-size: 10pt; margin: 8pt 0 3pt 0; }
p { margin: 0 0 4pt 0; }
table { border-collapse: collapse; width: 100%; margin-bottom: 4pt; }
th, td { border: 1px solid #cbd5e1; padding: 3pt 5pt; text-align: left; vertical-align: top; }
th { color: #334155; }
.muted { color: #64748b; font-size: 8.5pt; }
.item { margin: 0 0 1pt 0; }
.src { margin: 0 0 7pt 0; color: #475569; font-size: 8.5pt; }
.quote { color: #334155; font-style: italic; }
.ok { color: #065f46; font-weight: bold; }
.bad { color: #991b1b; font-weight: bold; }
"""

FOOTER = "Preliminary AI-assisted assessment for solicitor review. Not legal advice."


def _e(value: object) -> str:
    return escape(str(value), quote=True)


def build_report_html(case: Case, assessment: Assessment, generated_at: datetime) -> str:
    a = AssessmentOut.model_validate(assessment)
    docs = {0: "Client description", **{d.id: d.filename for d in case.documents}}
    bad_quotes = set(a.verification.unverified_quotes)
    bad_citations = set(a.verification.unverified_citations)
    sources = {s.id: s for s in a.sources}
    banner, banner_colour = STATUS_BANNERS.get(a.review_status, STATUS_BANNERS["pending"])

    out: list[str] = []
    add = out.append

    # ---- Header ----
    add(f'<p class="muted">{_e(settings.product_name)} · Preliminary case assessment</p>')
    add(f"<h1>{_e(case.title)}</h1>")
    add(f"<p><b>{_e(case.client_name)}</b> v <b>{_e(case.counterparty)}</b></p>")
    add(
        f'<p style="color:{banner_colour}; border:1.5px solid {banner_colour}; padding:4pt 6pt; '
        f'font-weight:bold;">{_e(banner)}</p>'
    )
    add("<table>")
    for label, value in [
        ("Date of alleged breach", case.breach_date.isoformat() if case.breach_date else "Not given"),
        ("Documents reviewed", ", ".join(d.filename for d in case.documents) or "None (client description only)"),
        ("Assessment", f"#{a.id}, created {a.created_at:%d %b %Y %H:%M} UTC, model {a.model}"),
        ("Report generated", f"{generated_at:%d %b %Y %H:%M} UTC"),
    ]:
        add(f"<tr><th>{_e(label)}</th><td>{_e(value)}</td></tr>")
    add("</table>")

    # ---- Case summary ----
    add("<h2>Client's account</h2>")
    add(f"<p>{_e(case.description)}</p>")

    # ---- Readiness ----
    r = a.readiness
    add("<h2>Evidence readiness</h2>")
    add(
        f'<p><span style="font-size:15pt; font-weight:bold;">{r.score}/100</span> '
        '<span class="muted">How completely the evidence covers each element of a breach of '
        "contract claim. It is not a prediction of outcome.</span></p>"
    )
    add("<table><tr><th>Element</th><th>Status</th><th>Supporting facts</th><th>Weight</th></tr>")
    for el in r.elements:
        add(
            f"<tr><td>{_e(ELEMENT_LABELS[el.element])}</td>"
            f'<td style="color:{STATUS_COLOURS[el.status]}; font-weight:bold;">{_e(el.status)}</td>'
            f"<td>{el.fact_count}</td><td>{el.weight:.0%}</td></tr>"
        )
    add("</table>")
    if r.excluded_facts:
        n = r.excluded_facts
        add(
            f'<p class="bad">{n} fact{"s" if n != 1 else ""} left out of the score because '
            f'{"their quotes were" if n != 1 else "its quote was"} not found in the source.</p>'
        )
    if r.flags:
        add("<h3>Flags</h3>")
        for flag in r.flags:
            add(f'<p style="color:#b45309;"><b>Warning:</b> {_e(flag)}</p>')

    # ---- Facts ----
    add("<h2>Facts extracted from the material</h2>")
    if not a.facts.facts:
        add('<p class="muted">No facts were extracted.</p>')
    for element in Element:
        facts = [f for f in a.facts.facts if f.element == element]
        if not facts:
            continue
        add(f"<h3>{_e(ELEMENT_LABELS[element])}</h3>")
        for f in facts:
            check = (
                '<span class="bad">Quote not found in source</span>'
                if f.source.quote in bad_quotes
                else '<span class="ok">Quote verified</span>'
            )
            source_name = docs.get(f.source.document_id, f"Document #{f.source.document_id}")
            add(f'<p class="item">{_e(f.statement)}</p>')
            add(
                f'<p class="src">{_e(source_name)}: <span class="quote">“{_e(f.source.quote)}”</span>'
                f" · {check}</p>"
            )

    # ---- Legislation ----
    add("<h2>Relevant legislation</h2>")
    if not a.facts.legal_issues:
        add('<p class="muted">No retrieved provision was judged relevant.</p>')
    for issue in a.facts.legal_issues:
        src = sources.get(issue.provision_id)
        citation = src.citation if src else issue.provision_id
        check = (
            '<span class="bad">Could not verify against statute text</span>'
            if issue.provision_id in bad_citations
            else '<span class="ok">Verified against statute text</span>'
        )
        add(f'<p class="item"><b>{_e(citation)}</b></p>')
        add(f'<p class="item">{_e(issue.issue)}</p>')
        add(f'<p class="src"><span class="quote">“{_e(issue.quote)}”</span> · {check}</p>')

    # ---- Open questions ----
    add("<h2>Questions for the solicitor</h2>")
    if a.facts.open_questions:
        add("<ul>" + "".join(f"<li>{_e(q)}</li>" for q in a.facts.open_questions) + "</ul>")
    else:
        add('<p class="muted">None raised.</p>')

    # ---- Review ----
    add("<h2>Review record</h2>")
    reviewed = f"{a.reviewed_at:%d %b %Y %H:%M} UTC" if a.reviewed_at else "Not yet reviewed"
    add(f"<p><b>Status:</b> {_e(a.review_status.capitalize())}</p>")
    add(f"<p><b>Reviewed:</b> {_e(reviewed)}</p>")
    add(f"<p><b>Reviewer note:</b> {_e(a.reviewer_note or '(none)')}</p>")

    # ---- Method & sources ----
    add("<h2>Method and sources</h2>")
    facts_ok = sum(f.source.quote not in bad_quotes for f in a.facts.facts)
    cites_ok = sum(i.provision_id not in bad_citations for i in a.facts.legal_issues)
    add(
        f"<p>Automated checks: {facts_ok} of {len(a.facts.facts)} fact quotes and {cites_ok} of "
        f"{len(a.facts.legal_issues)} statutory citations were found verbatim in their sources.</p>"
    )
    if a.sources:
        add("<h3>Provisions considered</h3>")
        for s in a.sources:
            how = "applied by the limitation check" if s.via == "rule" else "retrieved by keyword search"
            add(f'<p class="item">{_e(s.citation)}: {_e(s.title)} <span class="muted">({how})</span></p>')
            add(f'<p class="src">{_e(s.url)}</p>')
    add(
        '<p class="muted">Statutory text from legislation.gov.uk, contains public sector '
        "information licensed under the Open Government Licence v3.0. Facts were extracted by an "
        "AI model and must be checked against the original documents before being relied on. "
        "This report does not assess the merits of the claim and is not legal advice.</p>"
    )
    return "\n".join(out)


def render_pdf(html: str, title: str) -> bytes:
    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    page_rect = pymupdf.paper_rect("a4")
    content = page_rect + (45, 45, -45, -55)
    story = pymupdf.Story(html=html, user_css=CSS)
    more = True
    while more:
        device = writer.begin_page(page_rect)
        more, _ = story.place(content)
        story.draw(device)
        writer.end_page()
    writer.close()

    doc = pymupdf.open(stream=buf.getvalue(), filetype="pdf")
    total = doc.page_count
    for i, page in enumerate(doc):
        y = page_rect.height - 30
        page.insert_text((45, y), FOOTER, fontsize=7.5, color=(0.39, 0.45, 0.55))
        page.insert_text((page_rect.width - 95, y), f"Page {i + 1} of {total}", fontsize=7.5,
                         color=(0.39, 0.45, 0.55))
    doc.set_metadata({"title": title, "creator": settings.product_name, "producer": "PyMuPDF"})
    return doc.tobytes(garbage=3, deflate=True)


def build_report_pdf(case: Case, assessment: Assessment, generated_at: datetime | None = None) -> bytes:
    generated_at = generated_at or datetime.now(UTC)
    html = build_report_html(case, assessment, generated_at)
    return render_pdf(html, title=f"Assessment #{assessment.id}: {case.title}")
