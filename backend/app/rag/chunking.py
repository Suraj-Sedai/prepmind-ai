from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Optional

from app.rag.clean_text import clean_extracted_units, normalize_text
from app.rag.extract_text import extract_text_units
from app.rag.importance import detect_important_content, extract_topics_from_chunks
from app.rag.schemas import ExtractedTextUnit, ProcessedChunk, ProcessedDocument


HEADING_RE = re.compile(r"^[A-Z][A-Za-z0-9 /,&:()\-]{2,100}$")


def _looks_like_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or stripped.endswith("."):
        return False
    words = stripped.split()
    return 1 <= len(words) <= 12 and bool(HEADING_RE.match(stripped))


def _section_heading(unit: ExtractedTextUnit) -> Optional[str]:
    if unit.section_heading:
        return unit.section_heading[:180]
    for line in unit.cleaned_text.splitlines()[:8]:
        if _looks_like_heading(line):
            return line[:180]
    return None


def _chunk_words(text: str, words_per_chunk: int = 520, overlap: int = 80) -> list[str]:
    words = text.split()
    if not words:
        return []
    if len(words) <= words_per_chunk:
        return [" ".join(words)]

    chunks: list[str] = []
    step = max(words_per_chunk - overlap, 1)
    for start in range(0, len(words), step):
        current = words[start : start + words_per_chunk]
        if len(current) < 35 and chunks:
            break
        chunks.append(" ".join(current))
        if start + words_per_chunk >= len(words):
            break
    return chunks


def _semantic_blocks(unit: ExtractedTextUnit) -> list[tuple[Optional[str], str]]:
    lines = [line for line in unit.cleaned_text.splitlines() if line.strip()]
    if not lines:
        return []

    blocks: list[tuple[Optional[str], str]] = []
    current_heading = _section_heading(unit)
    current_lines: list[str] = []

    for line in lines:
        if _looks_like_heading(line) and current_lines:
            blocks.append((current_heading, normalize_text("\n".join(current_lines))))
            current_heading = line[:180]
            current_lines = [line]
            continue
        current_lines.append(line)

    if current_lines:
        blocks.append((current_heading, normalize_text("\n".join(current_lines))))
    return blocks


def process_document(path: Path) -> ProcessedDocument:
    extracted_units = extract_text_units(path)
    cleaned_units = clean_extracted_units(extracted_units)
    chunks: list[ProcessedChunk] = []
    skipped_junk_count = 0
    seen_hashes: set[str] = set()
    topic_candidates: list[tuple[str, str]] = []

    for unit in cleaned_units:
        if not unit.cleaned_text:
            skipped_junk_count += 1
            continue

        for section_heading, block_text in _semantic_blocks(unit):
            for chunk_text in _chunk_words(block_text):
                importance = detect_important_content(chunk_text, section_heading)
                if importance.label == "junk_content" or (
                    importance.label == "low_value_content" and importance.score < 0.28
                ):
                    skipped_junk_count += 1
                    continue

                normalized_for_hash = re.sub(r"\s+", " ", chunk_text).strip().lower()
                chunk_hash = hashlib.sha256(normalized_for_hash.encode("utf-8")).hexdigest()
                if chunk_hash in seen_hashes:
                    skipped_junk_count += 1
                    continue
                seen_hashes.add(chunk_hash)
                topic_candidates.append((chunk_text, section_heading or importance.topic))

                chunks.append(
                    ProcessedChunk(
                        text=chunk_text,
                        original_text=unit.original_text[:2000],
                        topic_label=importance.topic,
                        page_start=unit.page_number,
                        page_end=unit.page_number,
                        slide_start=unit.slide_number,
                        slide_end=unit.slide_number,
                        section_heading=section_heading,
                        content_type=importance.content_type,
                        importance_score=importance.score,
                        metadata={
                            "source_label": unit.source_label,
                            "importance_label": importance.label,
                            "importance_reason": importance.reason,
                        },
                    )
                )

    cleaned_text = "\n\n".join(unit.cleaned_text for unit in cleaned_units if unit.cleaned_text).strip()
    word_count = len(cleaned_text.split())
    topics = extract_topics_from_chunks(topic_candidates)
    return ProcessedDocument(
        cleaned_text=cleaned_text,
        chunks=chunks,
        topics=topics,
        word_count=word_count,
        unit_count=len(cleaned_units),
        skipped_junk_count=skipped_junk_count,
        scanned_or_empty=bool(extracted_units) and not cleaned_text,
    )
