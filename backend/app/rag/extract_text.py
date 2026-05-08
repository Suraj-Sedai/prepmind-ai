from __future__ import annotations

from pathlib import Path
from typing import Optional

from docx import Document as DocxDocument
from pypdf import PdfReader

from app.rag.schemas import ExtractedTextUnit


SUPPORTED_SUFFIXES = {".pdf", ".txt", ".md", ".docx"}


def _extract_pdf(path: Path) -> list[ExtractedTextUnit]:
    reader = PdfReader(str(path))
    units: list[ExtractedTextUnit] = []
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        units.append(
            ExtractedTextUnit(
                page_number=index + 1,
                slide_number=None,
                source_label=f"Page {index + 1}",
                original_text=text,
            )
        )
    return units


def _extract_text_file(path: Path) -> list[ExtractedTextUnit]:
    raw_text = path.read_text(encoding="utf-8", errors="ignore")
    parts = raw_text.split("\f")
    return [
        ExtractedTextUnit(
            page_number=index + 1,
            slide_number=None,
            source_label=f"Section {index + 1}",
            original_text=part,
        )
        for index, part in enumerate(parts)
    ]


def _extract_docx(path: Path) -> list[ExtractedTextUnit]:
    document = DocxDocument(str(path))
    lines: list[str] = []
    current_heading: Optional[str] = None

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style_name = paragraph.style.name.lower() if paragraph.style and paragraph.style.name else ""
        if style_name.startswith("heading"):
            current_heading = text
            lines.append(text)
            continue
        lines.append(text)

    return [
        ExtractedTextUnit(
            page_number=1,
            slide_number=None,
            source_label="Document",
            original_text="\n".join(lines),
            section_heading=current_heading,
        )
    ]


def extract_text_units(path: Path) -> list[ExtractedTextUnit]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(path)
    if suffix in {".txt", ".md"}:
        return _extract_text_file(path)
    if suffix == ".docx":
        return _extract_docx(path)
    raise ValueError(f"Unsupported file type: {suffix}")
