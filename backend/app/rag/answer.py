from __future__ import annotations

from typing import Optional

from app.core.config import get_settings
from app.models.document import DocumentChunk
from app.rag.embeddings import EmbeddingProviderUnavailable
from app.rag.llm import generate_model_text
from app.rag.prompts import GENERAL_ANSWER_PROMPT, GROUNDED_ANSWER_PROMPT
from app.rag.retrieval import evaluate_context_support, retrieve_relevant_chunks
from app.rag.schemas import AnswerStatus, ConfidenceLabel
from app.schemas.study import AskResponse, CitationItem


settings = get_settings()


def _generate_model_text(prompt: str) -> Optional[str]:
    return generate_model_text(prompt)


def _page_or_slide(chunk: DocumentChunk) -> Optional[str]:
    if chunk.page_start is not None and chunk.page_end is not None and chunk.page_start != chunk.page_end:
        return f"Pages {chunk.page_start}-{chunk.page_end}"
    if chunk.page_start is not None:
        return f"Page {chunk.page_start}"
    return None


def citation_from_chunk(chunk: DocumentChunk, snippet: str, relevance: Optional[float] = None) -> CitationItem:
    page_or_slide = _page_or_slide(chunk)
    return CitationItem(
        document_name=chunk.document.document_name,
        file_name=chunk.document.document_name,
        topic_label=chunk.topic_label,
        snippet=snippet,
        page_start=chunk.page_start,
        page_end=chunk.page_end,
        page_or_slide=page_or_slide,
        relevance=relevance,
    )


def _truncate(text: str, max_chars: int = 320) -> str:
    compact = " ".join(text.split())
    if len(compact) <= max_chars:
        return compact
    return compact[: max_chars - 3].rstrip() + "..."


def _context_blocks(chunks: list[DocumentChunk], max_words: int = 260) -> list[str]:
    blocks: list[str] = []
    for chunk in chunks:
        words = chunk.chunk_text.split()
        context = " ".join(words[:max_words])
        if len(words) > max_words:
            context += "..."
        page_or_slide = _page_or_slide(chunk) or "Location unknown"
        blocks.append(
            "\n".join(
                [
                    f"Source: {chunk.document.document_name}",
                    f"Location: {page_or_slide}",
                    f"Section: {chunk.section_heading or chunk.topic_label}",
                    f"Content type: {chunk.content_type}",
                    f"Context: {context}",
                ]
            )
        )
    return blocks


def _grounded_prompt(question: str, chunks: list[DocumentChunk]) -> str:
    return (
        GROUNDED_ANSWER_PROMPT
        + "\n\nStrict output rules for this response:\n"
        + "- Use only the uploaded material context below for document-grounded claims.\n"
        + "- Do not cite any source that is not listed below.\n"
        + "- If the context is insufficient, say: I could not find this in your uploaded materials.\n"
        + "- Keep the answer student-friendly and concise.\n\n"
        + f"Student question:\n{question}\n\n"
        + "Uploaded material context:\n"
        + "\n\n---\n\n".join(_context_blocks(chunks))
    )


def _general_prompt(question: str) -> str:
    return (
        GENERAL_ANSWER_PROMPT
        + "\n\n"
        f"Question: {question}"
    )


def _missing_response(allow_general: bool, question: str) -> tuple[str, AnswerStatus, list[CitationItem], ConfidenceLabel, bool]:
    missing = "I could not find this answer in your uploaded materials."
    if not allow_general:
        return missing, "not_found_in_documents", [], "low", False

    general_answer = _generate_model_text(_general_prompt(question))
    if not general_answer:
        return missing, "not_found_in_documents", [], "low", False

    answer = f"{missing}\n\nGeneral AI answer\n{general_answer}"
    source = CitationItem(
        document_name="General AI knowledge",
        file_name="General AI knowledge",
        topic_label="General AI knowledge",
        snippet="This answer was generated from the AI model, not from uploaded materials.",
        page_or_slide=None,
        relevance=None,
    )
    return answer, "general_ai_fallback", [source], "general", True


def answer_question_with_rag(db, user_id: int, question: str, document_id: Optional[int] = None) -> AskResponse:
    try:
        chunks = retrieve_relevant_chunks(db, user_id=user_id, question=question, document_id=document_id)
    except EmbeddingProviderUnavailable as exc:
        return AskResponse(
            answer_status="not_found_in_documents",
            answer=str(exc),
            sources=[],
            citations=[],
            confidence=0.0,
            confidence_label="low",
            used_general_ai=False,
        )
    support = evaluate_context_support(question, chunks)
    allow_general = settings.allow_general_ai_fallback

    if not support.has_sufficient_context:
        answer, status, sources, confidence_label, used_general_ai = _missing_response(allow_general, question)
        confidence = 0.25 if used_general_ai else 0.0
        return AskResponse(
            answer_status=status,
            answer=answer,
            sources=sources,
            citations=sources,
            confidence=confidence,
            confidence_label=confidence_label,
            used_general_ai=used_general_ai,
        )

    sources = [
        citation_from_chunk(
            chunk,
            snippet=_truncate(chunk.chunk_text),
            relevance=round(float(getattr(chunk, "_rag_score", 0.0)), 3),
        )
        for chunk in chunks
    ]
    answer = _generate_model_text(_grounded_prompt(question, chunks))
    if not answer:
        answer = (
            "According to your uploaded material:\n\n"
            + "\n".join(f"- {source.snippet} ({source.document_name}, {source.page_or_slide or 'location unknown'})" for source in sources)
        )

    confidence_map: dict[ConfidenceLabel, float] = {"high": 0.86, "medium": 0.62, "low": 0.2, "general": 0.25}
    return AskResponse(
        answer_status="answered_from_documents",
        answer=answer,
        sources=sources,
        citations=sources,
        confidence=confidence_map[support.confidence],
        confidence_label=support.confidence,
        used_general_ai=False,
    )
