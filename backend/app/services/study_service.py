import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.models.study import TopicMastery
from app.schemas.study import AskResponse, CitationItem


def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[A-Za-z]{3,}", text.lower())}


def retrieve_relevant_chunks(db: Session, user_id: int, question: str, limit: int = 3) -> list[DocumentChunk]:
    question_tokens = _tokens(question)
    chunks = db.scalars(
        select(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.user_id == user_id)
    ).all()

    ranked = sorted(
        chunks,
        key=lambda chunk: (
            len(question_tokens.intersection(_tokens(chunk.chunk_text))),
            chunk.chunk_word_count,
        ),
        reverse=True,
    )
    return ranked[:limit]


def answer_question(db: Session, user_id: int, question: str) -> AskResponse:
    chunks = retrieve_relevant_chunks(db, user_id=user_id, question=question)
    if not chunks:
        return AskResponse(
            answer=(
                "I don't have any uploaded study material yet. Add a PDF, TXT, or DOCX file and I can ground "
                "answers in that content."
            ),
            citations=[],
            confidence=0.0,
        )

    lines = []
    citations: list[CitationItem] = []
    total_overlap = 0
    question_tokens = _tokens(question)

    for chunk in chunks:
        overlap = len(question_tokens.intersection(_tokens(chunk.chunk_text)))
        total_overlap += overlap
        snippet = chunk.chunk_text[:260].strip()
        lines.append(
            f"{chunk.topic_label}: {snippet}"
        )
        citations.append(
            CitationItem(
                document_name=chunk.document.document_name,
                topic_label=chunk.topic_label,
                snippet=snippet,
            )
        )

        mastery = db.scalar(
            select(TopicMastery).where(
                TopicMastery.user_id == user_id,
                TopicMastery.topic_name == chunk.topic_label,
            )
        )
        if mastery is not None:
            mastery.last_reviewed = datetime.utcnow()
            mastery.study_frequency += 1
            mastery.mastery_score = min(95.0, mastery.mastery_score + 2.5)

    db.commit()

    confidence = min(0.95, 0.35 + total_overlap * 0.08)
    answer = (
        "Here’s the grounded study guidance I found from your uploaded materials:\n\n- "
        + "\n- ".join(lines)
        + "\n\nUse the cited snippets as the starting point for review. Once you share an API key, I can replace this "
        + "heuristic response with full RAG generation and richer explanations."
    )
    return AskResponse(answer=answer, citations=citations, confidence=round(confidence, 2))
