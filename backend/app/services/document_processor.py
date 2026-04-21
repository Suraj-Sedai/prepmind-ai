import re
from collections import Counter
from pathlib import Path
from typing import NamedTuple

from docx import Document as DocxDocument
from pypdf import PdfReader

STOPWORDS = {
    "about",
    "after",
    "again",
    "against",
    "because",
    "before",
    "between",
    "could",
    "their",
    "there",
    "these",
    "those",
    "through",
    "under",
    "which",
    "while",
    "with",
    "would",
    "study",
    "student",
    "system",
    "using",
    "from",
    "into",
    "that",
    "this",
    "have",
    "your",
    "will",
    "been",
    "also",
    "than",
    "them",
    "they",
    "over",
    "only",
}


class ProcessedDocument(NamedTuple):
    cleaned_text: str
    chunks: list[str]
    topics: list[str]
    word_count: int


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".docx":
        doc = DocxDocument(str(path))
        return "\n".join(paragraph.text for paragraph in doc.paragraphs)
    raise ValueError(f"Unsupported file type: {suffix}")


def clean_text(raw_text: str) -> str:
    text = raw_text.replace("\x00", " ")
    text = re.sub(r"[\r\f\v]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chunk_text(text: str, words_per_chunk: int = 420, overlap: int = 70) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    step = max(words_per_chunk - overlap, 1)
    for start in range(0, len(words), step):
        chunk_words = words[start : start + words_per_chunk]
        if not chunk_words:
            continue
        chunks.append(" ".join(chunk_words))
        if start + words_per_chunk >= len(words):
            break
    return chunks


def _rank_keywords(text: str, limit: int = 8) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z\-]{3,}", text.lower())
    counts = Counter(word for word in words if word not in STOPWORDS)
    return [word.title() for word, _ in counts.most_common(limit)]


def extract_topics(text: str, limit: int = 5) -> list[str]:
    topics = _rank_keywords(text, limit=limit)
    return topics or ["General"]


def choose_chunk_topic(chunk: str, global_topics: list[str]) -> str:
    lowered = chunk.lower()
    for topic in global_topics:
        if topic.lower() in lowered:
            return topic
    return global_topics[0] if global_topics else "General"


def process_document(path: Path) -> ProcessedDocument:
    raw_text = extract_text(path)
    cleaned = clean_text(raw_text)
    word_count = len(cleaned.split())
    topics = extract_topics(cleaned)
    chunks = chunk_text(cleaned)
    return ProcessedDocument(
        cleaned_text=cleaned,
        chunks=chunks,
        topics=topics,
        word_count=word_count,
    )
