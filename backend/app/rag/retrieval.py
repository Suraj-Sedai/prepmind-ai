import math
import re
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.rag.embeddings import cosine_similarity, deserialize_vector, embed_texts
from app.rag.schemas import ContextSupport


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
    "what",
    "when",
    "where",
    "why",
    "how",
}


def tokens(text: str) -> list[str]:
    return [token for token in re.findall(r"[A-Za-z][A-Za-z0-9\-]{2,}", text.lower()) if token not in STOPWORDS]


def is_broad_review_question(question: str) -> bool:
    lowered = question.lower()
    review_terms = {"summarize", "summary", "overview", "outline", "review", "main idea", "key points"}
    return any(term in lowered for term in review_terms)


def _idf_scores(chunks: list[DocumentChunk]) -> dict[str, float]:
    doc_freq: Counter[str] = Counter()
    total = len(chunks)
    for chunk in chunks:
        doc_freq.update(set(tokens(chunk.chunk_text)))
    return {
        token: math.log((1 + total) / (1 + frequency)) + 1.0
        for token, frequency in doc_freq.items()
    }


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left.intersection(right)) / len(left.union(right))


def _candidate_chunks(
    db: Session,
    user_id: int,
    topic: str | None = None,
    document_id: int | None = None,
) -> list[DocumentChunk]:
    query = (
        select(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(
            Document.user_id == user_id,
            Document.processing_status.in_(["ready", "processed"]),
            DocumentChunk.embedding_vector.is_not(None),
            DocumentChunk.embedding_model != "local-hash-v1",
        )
    )
    if document_id is not None:
        query = query.where(Document.id == document_id)
    if topic:
        query = query.where(DocumentChunk.topic_label == topic)
    chunks = db.scalars(query).all()
    if topic and not chunks:
        return _candidate_chunks(db, user_id, None, document_id)
    return chunks


def retrieve_relevant_chunks(
    db: Session,
    user_id: int,
    question: str,
    top_k: int = 12,
    final_limit: int = 5,
    topic: str | None = None,
    document_id: int | None = None,
) -> list[DocumentChunk]:
    chunks = _candidate_chunks(db, user_id, topic, document_id)
    if not chunks:
        return []

    query_vector, _ = embed_texts([question], task_type="RETRIEVAL_QUERY")
    query_embedding = query_vector[0] if query_vector else []
    question_counts = Counter(tokens(question))
    idf = _idf_scores(chunks)
    scored: list[tuple[float, int, float, DocumentChunk]] = []

    for chunk in chunks:
        chunk_counts = Counter(tokens(chunk.chunk_text))
        overlap = set(question_counts).intersection(chunk_counts)
        overlap_count = len(overlap)
        lexical_score = sum(min(question_counts[token], chunk_counts[token]) * idf.get(token, 1.0) for token in overlap)
        vector_score = cosine_similarity(query_embedding, deserialize_vector(chunk.embedding_vector))
        exact_bonus = 0.08 if any(token in chunk.chunk_text.lower() for token in question_counts) else 0.0
        importance_bonus = min(float(chunk.importance_score or 0.4), 1.0) * 0.12
        topic_bonus = 0.0
        if topic and topic.lower() in chunk.topic_label.lower():
            topic_bonus = 0.18
        score = vector_score * 0.68 + (lexical_score / math.sqrt(max(chunk.chunk_word_count, 1))) * 0.22
        score += exact_bonus + importance_bonus + topic_bonus
        setattr(chunk, "_rag_score", score)
        setattr(chunk, "_vector_score", vector_score)
        setattr(chunk, "_keyword_overlap", overlap_count)
        scored.append((score, overlap_count, vector_score, chunk))

    scored.sort(key=lambda item: (item[0], item[1], item[3].importance_score or 0), reverse=True)
    candidates = scored[:top_k]
    selected: list[DocumentChunk] = []
    selected_signatures: list[set[str]] = []
    per_document_topic: Counter[tuple[int, str]] = Counter()

    for score, overlap_count, vector_score, chunk in candidates:
        if not is_broad_review_question(question) and score < 0.12 and overlap_count == 0 and vector_score < 0.2:
            continue

        signature = set(tokens(chunk.chunk_text))
        if selected_signatures and max(_jaccard(signature, existing) for existing in selected_signatures) >= 0.82:
            continue

        key = (chunk.document_id, chunk.topic_label.lower())
        if per_document_topic[key] >= 2:
            continue

        selected.append(chunk)
        selected_signatures.append(signature)
        per_document_topic[key] += 1
        if len(selected) >= final_limit:
            break

    return selected


def evaluate_context_support(question: str, chunks: list[DocumentChunk]) -> ContextSupport:
    if not chunks:
        return ContextSupport(False, "low", 0.0, "No chunks were retrieved for the question.")

    if is_broad_review_question(question):
        score = max(float(getattr(chunk, "_rag_score", 0.0)) for chunk in chunks)
        confidence = "medium" if score < 0.35 else "high"
        return ContextSupport(True, confidence, score, "The question asks for a broad review of available material.")

    question_terms = set(tokens(question))
    overlap = sum(int(getattr(chunk, "_keyword_overlap", 0)) for chunk in chunks)
    top_score = max(float(getattr(chunk, "_rag_score", 0.0)) for chunk in chunks)
    top_vector = max(float(getattr(chunk, "_vector_score", 0.0)) for chunk in chunks)
    chunk_text = " ".join(chunk.chunk_text.lower() for chunk in chunks)
    exact_hits = sum(1 for term in question_terms if term in chunk_text)

    support_score = top_score + min(0.2, overlap * 0.04) + min(0.16, exact_hits * 0.04)
    if support_score >= 0.5 or (top_vector >= 0.34 and exact_hits >= 1) or exact_hits >= 3:
        return ContextSupport(True, "high", support_score, "Retrieved chunks directly overlap with the question.")
    if support_score >= 0.3 and overlap >= 1:
        return ContextSupport(True, "medium", support_score, "Retrieved chunks partially support the question.")
    return ContextSupport(False, "low", support_score, "Retrieved chunks do not appear strong enough to answer.")
