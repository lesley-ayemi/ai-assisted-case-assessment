"""PDF export of an assessment, for the solicitor's file.

The report is built as HTML (a pure function, easy to test) and rendered to A4 with
PyMuPDF's Story API, which the app already uses for PDF text extraction.
"""

import io
from datetime import UTC, date, datetime
from html import escape

import pymupdf

from app.config import settings
from app.models import Assessment, Case
from app.schemas import AssessmentOut, Element
from app.services.readiness import CREDIT, LIMITATION_YEARS, _add_years

ELEMENT_LABELS = {
    Element.CONTRACT_FORMED: "Contract formed",
    Element.TERMS_IDENTIFIED: "Terms identified",
    Element.BREACH: "Breach",
    Element.LOSS: "Loss",
    Element.CAUSATION: "Causation",
    Element.PRE_ACTION: "Pre-action steps",
}

# Background fills are avoided throughout: PyMuPDF's Story repaints them on later pages.
# Colours follow the web app's tokens.
INK, SOFT, FAINT, LINE = "#14302f", "#4d6463", "#7d908f", "#dfe5e4"
OK, WARN, BAD, BRAND = "#1e6b4a", "#8a5a00", "#a3322a", "#1e5a4c"

STATUS_BANNERS = {
    "pending": ("DRAFT: NOT YET REVIEWED BY A SOLICITOR", WARN),
    "rejected": ("REJECTED BY THE REVIEWING SOLICITOR", BAD),
    "amended": ("APPROVED WITH AMENDMENTS: SEE REVIEWER NOTE", BRAND),
    "approved": ("APPROVED BY THE REVIEWING SOLICITOR", OK),
}
# Short form for the running header on later pages.
STATUS_SHORT = {"pending": "Draft", "rejected": "Rejected", "amended": "Approved with amendments", "approved": "Approved"}

STATUS_COLOURS = {"supported": OK, "weak": WARN, "missing": BAD}

CSS = f"""
body {{ font-family: sans-serif; font-size: 9.5pt; color: {INK}; line-height: 1.4; }}
h1 {{ font-size: 19pt; margin: 10pt 0 2pt 0; }}
h2 {{ font-size: 11.5pt; margin: 16pt 0 6pt 0; padding-bottom: 3pt; border-bottom: 1px solid {LINE}; }}
h3 {{ font-size: 9.5pt; margin: 9pt 0 3pt 0; color: {SOFT}; }}
p {{ margin: 0 0 4pt 0; }}
table {{ border-collapse: collapse; width: 100%; margin-bottom: 4pt; }}
th, td {{ border-bottom: 1px solid {LINE}; padding: 4pt 5pt; text-align: left; vertical-align: top; }}
th {{ color: {SOFT}; font-weight: normal; font-size: 8.5pt; }}
.masthead {{ border-bottom: 2px solid {INK}; padding-bottom: 4pt; margin-bottom: 0; }}
.muted {{ color: {SOFT}; font-size: 8.5pt; }}
.faint {{ color: {FAINT}; font-size: 8pt; }}
.num {{ text-align: right; }}
.big {{ font-size: 15pt; font-weight: bold; }}
.statement {{ margin: 0 0 1pt 0; font-weight: bold; }}
.quote {{ font-family: serif; font-size: 10pt; color: {INK}; margin: 0 0 1pt 0;
          padding-left: 6pt; border-left: 2px solid {LINE}; }}
.src {{ margin: 0 0 8pt 0; color: {SOFT}; font-size: 8.5pt; }}
.ok {{ color: {OK}; font-weight: bold; }}
.warn {{ color: {WARN}; font-weight: bold; }}
.bad {{ color: {BAD}; font-weight: bold; }}
"""

FOOTER = "Preliminary AI-assisted assessment for solicitor review. Not legal advice."


def _e(value: object) -> str:
    return escape(str(value), quote=True)


def _date(d) -> str:
    return f"{d.day} {d:%B %Y}"


def _span(start: date, end: date) -> str:
    """Whole years and months between two dates, e.g. "4 years 9 months"."""
    months = (end.year - start.year) * 12 + end.month - start.month - (end.day < start.day)
    if months < 1:
        days = (end - start).days
        return f"{days} day{'s' if days != 1 else ''}"
    y, m = divmod(months, 12)
    parts = [f"{y} year{'s' if y != 1 else ''}" if y else "", f"{m} month{'s' if m != 1 else ''}" if m else ""]
    return " ".join(p for p in parts if p)


def _limitation(breach: date | None, today: date) -> tuple[str, str]:
    if breach is None:
        return "Breach date unknown, so the limitation period can't be checked", WARN
    expiry = _add_years(breach, LIMITATION_YEARS)
    if expiry <= today:
        return f"Ended on {_date(expiry)}, {_span(expiry, today)} ago", BAD
    colour = WARN if _add_years(today, 1) > expiry else OK
    return f"Ends on {_date(expiry)}, {_span(today, expiry)} left", colour


def _points(weight: float, status: str) -> float:
    return round(weight * 100 * CREDIT[status], 1)


def _fmt(n: float) -> str:
    return f"{n:g}"


def build_report_html(case: Case, assessment: Assessment, generated_at: datetime) -> str:
    a = AssessmentOut.model_validate(assessment)
    docs = {0: "Client's account", **{d.id: d.filename for d in case.documents}}
    bad_quotes = set(a.verification.unverified_quotes)
    bad_citations = set(a.verification.unverified_citations)
    sources = {s.id: s for s in a.sources}
    banner, banner_colour = STATUS_BANNERS.get(a.review_status, STATUS_BANNERS["pending"])
    r = a.readiness
    facts_ok = sum(f.source.quote not in bad_quotes for f in a.facts.facts)
    cites_ok = sum(i.provision_id not in bad_citations for i in a.facts.legal_issues)
    supported = sum(el.status == "supported" for el in r.elements)

    out: list[str] = []
    add = out.append

    # ---- Masthead and title ----
    add(
        '<table class="masthead"><tr>'
        '<td width="50%" style="border:none; padding:0; font-size:11pt;">'
        f"<b>&#167; {_e(settings.product_name)}</b></td>"
        f'<td width="50%" style="border:none; padding:0; font-size:11pt; text-align:right; color:{SOFT};">'
        "Preliminary case assessment</td>"
        "</tr></table>"
    )
    add(f"<h1>{_e(case.title)}</h1>")
    add(f"<p>{_e(case.client_name)} <span class='muted'>(client)</span> v {_e(case.counterparty)}</p>")
    add(
        f'<p style="color:{banner_colour}; border:1.5px solid {banner_colour}; padding:5pt 7pt; '
        f'margin-top:8pt; font-weight:bold;">{_e(banner)}</p>'
    )

    # ---- At a glance ----
    def glance(label: str, value: str, note: str, colour: str = INK) -> str:
        return (
            f'<td style="border:1px solid {LINE}; padding:6pt 7pt;"><p class="muted">{_e(label)}</p>'
            f'<p class="big" style="color:{colour};">{_e(value)}</p><p class="faint">{_e(note)}</p></td>'
        )

    add("<table style='margin-top:8pt;'><tr>")
    add(glance("Evidence readiness", f"{r.score}/100", "Not a prediction of outcome"))
    add(glance("Elements supported", f"{supported} of {len(r.elements)}", "Two or more facts each"))
    add(
        glance(
            "Quotes found in source",
            f"{facts_ok} of {len(a.facts.facts)}",
            "All found" if facts_ok == len(a.facts.facts) else f"{len(a.facts.facts) - facts_ok} not found",
            OK if facts_ok == len(a.facts.facts) else BAD,
        )
    )
    add(
        glance(
            "Citations verified",
            f"{cites_ok} of {len(a.facts.legal_issues)}",
            "Match the statute" if cites_ok == len(a.facts.legal_issues) else "Some don't match",
            OK if cites_ok == len(a.facts.legal_issues) else BAD,
        )
    )
    add("</tr></table>")

    # ---- Key details ----
    limitation, limitation_colour = _limitation(case.breach_date, generated_at.date())
    model = "Stub (keyword matching, no AI model)" if a.model == "stub" else a.model
    add("<h2>Case details</h2><table>")
    for label, value, colour in [
        ("Date of alleged breach", _date(case.breach_date) if case.breach_date else "Not given", INK),
        ("Limitation period", limitation, limitation_colour),
        ("Documents reviewed", ", ".join(d.filename for d in case.documents) or "None (client's account only)", INK),
        ("Assessment", f"No. {a.id}, run {a.created_at:%d %b %Y %H:%M} UTC", INK),
        ("Extraction", model, WARN if a.model == "stub" else INK),
        ("Report generated", f"{generated_at:%d %b %Y %H:%M} UTC", INK),
    ]:
        add(
            f'<tr><td width="28%" class="muted">{_e(label)}</td>'
            f'<td width="72%" style="color:{colour};">{_e(value)}</td></tr>'
        )
    add("</table>")

    add("<h2>Client's account</h2>")
    add(f'<p class="quote">{_e(case.description)}</p>')

    # ---- Readiness ----
    add("<h2>Evidence readiness</h2>")
    add(
        '<p class="muted">How completely the evidence covers each element of a breach of contract claim. '
        "Two or more supporting facts earn an element's full points, one earns half, none earns nothing. "
        "It is not a prediction of outcome.</p>"
    )
    add(
        '<table><tr><th>Element</th><th class="num">Facts</th><th class="num">Points</th>'
        '<th class="num">Status</th></tr>'
    )
    gains: list[tuple[float, str]] = []
    for el in r.elements:
        earned, most = _points(el.weight, el.status), round(el.weight * 100)
        if earned < most:
            gains.append((most - earned, ELEMENT_LABELS[el.element]))
        add(
            f"<tr><td>{_e(ELEMENT_LABELS[el.element])}</td><td class='num'>{el.fact_count}</td>"
            f"<td class='num'><b>{_fmt(earned)}</b> <span class='muted'>/ {most}</span></td>"
            f'<td class="num" style="color:{STATUS_COLOURS[el.status]}; font-weight:bold;">'
            f"{_e(el.status.capitalize())}</td></tr>"
        )
    add(
        f'<tr><td style="border-bottom:none;"><b>Total</b></td><td style="border-bottom:none;"></td>'
        f'<td class="num" style="border-bottom:none;"><b>{r.score}</b> <span class="muted">/ 100</span></td>'
        '<td style="border-bottom:none;"></td></tr></table>'
    )
    if gains:
        top = sorted(gains, reverse=True)[:2]
        add(
            f'<p style="color:{BRAND};"><b>Most to gain:</b> '
            + " and ".join(f"{_e(name)} (+{_fmt(g)})" for g, name in top)
            + ". More evidence here would raise the score most.</p>"
        )
    if r.excluded_facts:
        n = r.excluded_facts
        add(
            f'<p class="bad">{n} fact{"s" if n != 1 else ""} left out of the score because '
            f'{"their quotes were" if n != 1 else "its quote was"} not found in the source.</p>'
        )
    for flag in r.flags:
        add(f'<p style="color:{WARN};"><b>Warning:</b> {_e(flag)}</p>')

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
            found = f.source.quote not in bad_quotes
            check = (
                '<span class="ok">Quote verified</span>'
                if found
                else '<span class="bad">Quote not found in source: left out of the score</span>'
            )
            source_name = docs.get(f.source.document_id, f"Document {f.source.document_id}")
            add(f'<p class="statement">{_e(f.statement)}</p>')
            add(f'<p class="quote">&#8220;{_e(f.source.quote)}&#8221;</p>')
            add(f'<p class="src">{_e(source_name)}. {check}</p>')

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
        add(f'<p class="statement">{_e(citation)}</p>')
        add(f"<p>{_e(issue.issue)}</p>")
        add(f'<p class="quote">&#8220;{_e(issue.quote)}&#8221;</p>')
        add(f'<p class="src">{check}</p>')

    # ---- Open questions ----
    add("<h2>Questions for the solicitor</h2>")
    if a.facts.open_questions:
        add('<p class="muted">To confirm with the client before relying on this assessment.</p>')
        add("<ol>" + "".join(f"<li>{_e(q)}</li>" for q in a.facts.open_questions) + "</ol>")
    else:
        add('<p class="muted">None raised.</p>')

    # ---- Review ----
    add("<h2>Review record</h2>")
    if a.review_status == "pending":
        add(
            '<p class="muted">Not yet reviewed. Record the decision in the app, or sign here if reviewing on '
            "paper.</p>"
        )
        add(
            '<p style="margin-top:14pt;">Decision ' + "_" * 38 + "&#160;&#160;&#160; Date " + "_" * 22 + "</p>"
            '<p style="margin-top:14pt;">Reviewed by ' + "_" * 34 + "&#160;&#160;&#160; Signature " + "_" * 17 + "</p>"
        )
    else:
        reviewed = f"{a.reviewed_at:%d %b %Y %H:%M} UTC" if a.reviewed_at else "Time not recorded"
        add("<table>")
        add(
            f'<tr><td width="28%" class="muted">Decision</td><td width="72%" style="color:{banner_colour};"><b>'
            f"{_e(STATUS_SHORT.get(a.review_status, a.review_status))}</b></td></tr>"
        )
        add(f'<tr><td class="muted">Recorded</td><td>{_e(reviewed)}</td></tr>')
        add(f"<tr><td class='muted'>Reviewer note</td><td>{_e(a.reviewer_note or '(none)')}</td></tr>")
        add("</table>")

    # ---- Method & sources ----
    add("<h2>Method and sources</h2>")
    add(
        f"<p>Automated checks: {facts_ok} of {len(a.facts.facts)} fact quotes and {cites_ok} of "
        f"{len(a.facts.legal_issues)} statutory citations were found verbatim in their sources.</p>"
    )
    if a.sources:
        add("<h3>Provisions considered</h3>")
        add("<table><tr><th>Provision</th><th>How it was found</th></tr>")
        for s in a.sources:
            how = "Applied by the limitation check" if s.via == "rule" else "Retrieved by keyword search"
            add(
                f"<tr><td><b>{_e(s.citation)}</b><br/><span class='muted'>{_e(s.title)}</span><br/>"
                f"<span class='faint'>{_e(s.url)}</span></td><td class='muted'>{how}</td></tr>"
            )
        add("</table>")
    add(
        '<p class="faint" style="margin-top:8pt;">Statutory text from legislation.gov.uk, contains public sector '
        "information licensed under the Open Government Licence v3.0. Facts were extracted automatically and "
        "must be checked against the original documents before being relied on. This report does not assess "
        "the merits of the claim and is not legal advice.</p>"
    )
    return "\n".join(out)


def _rgb(hex_colour: str) -> tuple[float, float, float]:
    h = hex_colour.lstrip("#")
    return tuple(int(h[k : k + 2], 16) / 255 for k in (0, 2, 4))  # type: ignore[return-value]


def render_pdf(html: str, title: str, running_title: str = "", status: tuple[str, str] | None = None) -> bytes:
    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    page_rect = pymupdf.paper_rect("a4")
    content = page_rect + (45, 50, -45, -55)
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
    left, right = 45, page_rect.width - 45
    for i, page in enumerate(doc):
        # Footer on every page: a hairline, the disclaimer and the page number.
        y = page_rect.height - 30
        page.draw_line((left, y - 10), (right, y - 10), color=_rgb(LINE), width=0.6)
        page.insert_text((left, y), FOOTER, fontsize=7.5, color=_rgb(SOFT))
        label = f"Page {i + 1} of {total}"
        page.insert_text((right - pymupdf.get_text_length(label, fontsize=7.5), y), label, fontsize=7.5,
                         color=_rgb(SOFT))
        # Running header from page 2, so a loose page still says what it is and its status.
        if i > 0 and running_title:
            page.insert_text((left, 30), f"{settings.product_name}: {running_title}"[:95], fontsize=7.5,
                             color=_rgb(SOFT))
            if status:
                text, colour = status
                page.insert_text((right - pymupdf.get_text_length(text, fontname="helv", fontsize=7.5), 30),
                                 text, fontsize=7.5, color=_rgb(colour))
            page.draw_line((left, 36), (right, 36), color=_rgb(LINE), width=0.6)
    doc.set_metadata({"title": title, "creator": settings.product_name, "producer": "PyMuPDF"})
    return doc.tobytes(garbage=3, deflate=True)


def build_report_pdf(case: Case, assessment: Assessment, generated_at: datetime | None = None) -> bytes:
    generated_at = generated_at or datetime.now(UTC)
    html = build_report_html(case, assessment, generated_at)
    status = assessment.review_status
    return render_pdf(
        html,
        title=f"Assessment {assessment.id}: {case.title}",
        running_title=case.title,
        status=(STATUS_SHORT.get(status, status), STATUS_BANNERS.get(status, STATUS_BANNERS["pending"])[1]),
    )
