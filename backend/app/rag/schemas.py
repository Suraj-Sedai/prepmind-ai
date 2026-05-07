from dataclasses import dataclass, field
from typing import Literal


ImportanceLabel = Literal["important_content", "supporting_content", "low_value_content", "junk_content"]
AnswerStatus = Literal["answered_from_documents", "not_found_in_documents", "general_ai_fallback"]
ConfidenceLabel = Literal["high", "medium", "low", "general"]


@dataclass(frozen=True)
class ExtractedTextUnit:
    page_number: int | None
    slide_number: int | None
    source_label: str
    original_text: str
    cleaned_text: str = ""
    section_heading: str | None = None


@dataclass(frozen=True)
class ContentImportance:
    label: ImportanceLabel
    score: float
    topic: str
    content_type: str
    reason: str


@dataclass(frozen=True)
class ProcessedChunk:
    text: str
    original_text: str
    topic_label: str
    page_start: int | None
    page_end: int | None
    slide_start: int | None = None
    slide_end: int | None = None
    section_heading: str | None = None
    content_type: str = "supporting_content"
    importance_score: float = 0.5
    metadata: dict[str, str | int | float | None] = field(default_factory=dict)


@dataclass(frozen=True)
class ProcessedDocument:
    cleaned_text: str
    chunks: list[ProcessedChunk]
    topics: list[str]
    word_count: int
    unit_count: int
    skipped_junk_count: int
    scanned_or_empty: bool = False


@dataclass(frozen=True)
class ContextSupport:
    has_sufficient_context: bool
    confidence: ConfidenceLabel
    score: float
    reason: str

