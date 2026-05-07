import re
from collections import Counter

from app.rag.schemas import ExtractedTextUnit


PAGE_NUMBER_RE = re.compile(r"^\s*(?:page\s*)?\d{1,4}\s*$", re.IGNORECASE)
COPYRIGHT_RE = re.compile(r"(copyright|all rights reserved|confidential|do not distribute)", re.IGNORECASE)
NAVIGATION_RE = re.compile(r"^(next|previous|chapter outline|contents|table of contents)\s*$", re.IGNORECASE)


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    text = re.sub(r"[\r\v]+", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    lines = [line.strip() for line in text.split("\n")]
    compact_lines: list[str] = []
    for line in lines:
        if not line:
            if compact_lines and compact_lines[-1]:
                compact_lines.append("")
            continue
        compact_lines.append(line)
    return "\n".join(compact_lines).strip()


def _line_key(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip().lower())


def _repeated_line_keys(units: list[ExtractedTextUnit]) -> set[str]:
    if len(units) < 3:
        return set()

    unit_count = len(units)
    counts: Counter[str] = Counter()
    for unit in units:
        seen_in_unit = {
            _line_key(line)
            for line in normalize_text(unit.original_text).splitlines()
            if 4 <= len(line.strip()) <= 120
        }
        counts.update(seen_in_unit)

    return {
        key
        for key, count in counts.items()
        if count >= 3 and count / unit_count >= 0.45
    }


def _is_disposable_line(line: str, repeated_keys: set[str]) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if PAGE_NUMBER_RE.match(stripped):
        return True
    if NAVIGATION_RE.match(stripped):
        return True
    if COPYRIGHT_RE.search(stripped) and len(stripped) <= 160:
        return True
    return _line_key(stripped) in repeated_keys


def _looks_like_table_of_contents(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 4:
        return False
    toc_lines = sum(1 for line in lines if re.search(r"\.{2,}\s*\d+$|\s+\d{1,4}$", line))
    sentence_lines = sum(1 for line in lines if re.search(r"[.!?]\s*$", line))
    return toc_lines / len(lines) >= 0.55 and sentence_lines <= max(1, len(lines) // 5)


def clean_extracted_units(units: list[ExtractedTextUnit]) -> list[ExtractedTextUnit]:
    repeated_keys = _repeated_line_keys(units)
    cleaned_units: list[ExtractedTextUnit] = []

    for unit in units:
        normalized = normalize_text(unit.original_text)
        lines = [
            line
            for line in normalized.splitlines()
            if not _is_disposable_line(line, repeated_keys)
        ]
        cleaned = normalize_text("\n".join(lines))
        if _looks_like_table_of_contents(cleaned):
            cleaned = ""
        cleaned_units.append(
            ExtractedTextUnit(
                page_number=unit.page_number,
                slide_number=unit.slide_number,
                source_label=unit.source_label,
                original_text=unit.original_text,
                cleaned_text=cleaned,
                section_heading=unit.section_heading,
            )
        )

    return cleaned_units


def is_junk_text(text: str) -> bool:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return True
    if PAGE_NUMBER_RE.match(compact):
        return True
    if len(re.findall(r"[A-Za-z0-9]", compact)) < max(8, len(compact) * 0.35):
        return True
    return _looks_like_table_of_contents(text)

