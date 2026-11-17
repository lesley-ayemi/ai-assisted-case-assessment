"""Turn uploaded files into plain text."""

import pymupdf as fitz


class UnsupportedDocument(ValueError):
    pass


def extract_text(data: bytes, content_type: str, filename: str) -> tuple[str, int]:
    """Return (text, page_count). Plain text files count as one page."""
    name = filename.lower()
    if content_type == "application/pdf" or name.endswith(".pdf"):
        with fitz.open(stream=data, filetype="pdf") as pdf:
            pages = [f"[page {i + 1}]\n{page.get_text()}" for i, page in enumerate(pdf)]
            return "\n".join(pages), len(pages)
    if content_type.startswith("text/") or name.endswith((".txt", ".md", ".eml")):
        return data.decode("utf-8", errors="replace"), 1
    raise UnsupportedDocument(f"Unsupported file type: {content_type or filename}")
