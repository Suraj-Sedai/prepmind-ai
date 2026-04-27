import math
import random
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document, DocumentChunk
from app.models.study import Flashcard, QuizAttempt, TopicMastery
from app.services.embedding_service import cosine_similarity, deserialize_vector, embed_texts
from app.services.llm_service import generate_general_answer, generate_grounded_answer
from app.schemas.study import (
    AskResponse,
    CitationItem,
    ExamStartResponse,
    ExamSubmitResponse,
    FlashcardGenerateResponse,
    FlashcardItem,
    FlashcardListResponse,
    QuizGenerateResponse,
    QuizQuestion,
    QuizResultItem,
    QuizSubmitResponse,
    QuestionOption,
)

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

QUESTION_TYPES = ["multiple_choice", "true_false", "fill_blank", "short_answer"]
settings = get_settings()
serializer = URLSafeSerializer(settings.session_secret, salt="prepmind-study")


def _tokens(text: str) -> list[str]:
    return [token for token in re.findall(r"[A-Za-z]{3,}", text.lower()) if token not in STOPWORDS]


def _token_set(text: str) -> set[str]:
    return set(_tokens(text))


def _sentence_split(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [sentence.strip() for sentence in sentences if len(sentence.strip().split()) >= 7]


def _idf_scores(chunks: list[DocumentChunk]) -> dict[str, float]:
    if not chunks:
        return {}

    doc_freq: Counter[str] = Counter()
    total = len(chunks)
    for chunk in chunks:
        doc_freq.update(set(_tokens(chunk.chunk_text)))

    return {
        token: math.log((1 + total) / (1 + freq)) + 1.0
        for token, freq in doc_freq.items()
    }


def retrieve_relevant_chunks(
    db: Session,
    user_id: int,
    question: str,
    limit: int = 4,
    topic: str | None = None,
) -> list[DocumentChunk]:
    base_query = (
        select(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.user_id == user_id)
    )
    query = base_query
    if topic:
        query = query.where(DocumentChunk.topic_label == topic)

    chunks = db.scalars(query).all()
    if topic and not chunks:
        chunks = db.scalars(base_query).all()
    if not chunks:
        return []

    question_tokens = Counter(_tokens(question))
    question_vector, _ = embed_texts([question], task_type="RETRIEVAL_QUERY")
    query_embedding = question_vector[0] if question_vector else []
    idf = _idf_scores(chunks)
    scored: list[tuple[float, int, float, DocumentChunk]] = []
    for chunk in chunks:
        chunk_tokens = Counter(_tokens(chunk.chunk_text))
        overlap = set(question_tokens).intersection(chunk_tokens)
        overlap_count = len(overlap)
        lexical = sum(min(question_tokens[token], chunk_tokens[token]) * idf.get(token, 1.0) for token in overlap)
        vector_score = cosine_similarity(query_embedding, deserialize_vector(chunk.embedding_vector))
        topic_bonus = 0.0
        if topic:
            if chunk.topic_label.lower() == topic.lower():
                topic_bonus += 0.4
            if topic.lower() in chunk.chunk_text.lower():
                topic_bonus += 0.25
        score = vector_score * 0.7 + (lexical / math.sqrt(max(chunk.chunk_word_count, 1))) * 0.3 + topic_bonus
        scored.append((score, overlap_count, vector_score, chunk))

    scored.sort(key=lambda item: (item[0], item[3].chunk_word_count), reverse=True)

    relevant_chunks = [
        chunk
        for score, overlap_count, vector_score, chunk in scored
        if score >= 0.18 or overlap_count >= 2 or (overlap_count >= 1 and vector_score >= 0.45)
    ]
    if relevant_chunks:
        return relevant_chunks[:limit]

    return []


def _upsert_mastery(db: Session, user_id: int, topic_name: str, delta: float, study_bump: int = 1) -> None:
    mastery = db.scalar(
        select(TopicMastery).where(
            TopicMastery.user_id == user_id,
            TopicMastery.topic_name == topic_name,
        )
    )
    if mastery is None:
        mastery = TopicMastery(
            user_id=user_id,
            topic_name=topic_name,
            mastery_score=max(20.0, min(95.0, 45.0 + delta)),
            study_frequency=max(1, study_bump),
            last_reviewed=datetime.utcnow(),
        )
        db.add(mastery)
        return

    mastery.mastery_score = max(10.0, min(99.0, mastery.mastery_score + delta))
    mastery.study_frequency += study_bump
    mastery.last_reviewed = datetime.utcnow()


def answer_question(db: Session, user_id: int, question: str) -> AskResponse:
    chunks = retrieve_relevant_chunks(db, user_id=user_id, question=question)
    if not chunks:
        general_answer = generate_general_answer(question)
        return AskResponse(
            answer=(
                general_answer
                or "I can answer general questions, but general mode is limited without an AI API key. "
                "You can still upload notes, PDF, TXT, or DOCX files and I will answer from that material."
            ),
            citations=[],
            confidence=0.2 if general_answer else 0.0,
        )

    question_tokens = Counter(_tokens(question))
    citations: list[CitationItem] = []
    synthesis_lines: list[str] = []
    overlap_total = 0.0

    for chunk in chunks:
        chunk_tokens = Counter(_tokens(chunk.chunk_text))
        overlap = set(question_tokens).intersection(chunk_tokens)
        overlap_total += sum(question_tokens[token] for token in overlap)
        snippet = chunk.chunk_text[:280].strip()
        synthesis_lines.append(f"{chunk.topic_label}: {snippet}")
        citations.append(
            CitationItem(
                document_name=chunk.document.document_name,
                topic_label=chunk.topic_label,
                snippet=snippet,
            )
        )
        _upsert_mastery(db, user_id, chunk.topic_label, delta=2.0)

    db.commit()

    confidence = min(0.97, 0.45 + overlap_total * 0.06)
    answer = generate_grounded_answer(question, citations)
    if answer is None:
        answer = (
            "Here is a grounded answer based on your uploaded material:\n\n- "
            + "\n- ".join(synthesis_lines)
            + "\n\nUse the citations to review the exact source language, then follow with flashcards or a quiz on the same topic."
        )
    return AskResponse(answer=answer, citations=citations, confidence=round(confidence, 2))


def _difficulty_from_text(text: str) -> str:
    words = len(text.split())
    if words < 14:
        return "easy"
    if words < 26:
        return "medium"
    return "hard"


def generate_flashcards(
    db: Session,
    user_id: int,
    count: int,
    difficulty: str,
    topic: str | None = None,
) -> FlashcardGenerateResponse:
    chunks = retrieve_relevant_chunks(
        db,
        user_id=user_id,
        question=topic or "important concepts key ideas exam review",
        limit=max(count, 6),
        topic=topic,
    )
    if not chunks:
        return FlashcardGenerateResponse(message="No indexed study material available yet.", items=[])

    created: list[Flashcard] = []
    seen_questions: set[str] = set()

    for chunk in chunks:
        for sentence in _sentence_split(chunk.chunk_text):
            prompt = f"What should you remember about {chunk.topic_label}?"
            answer = sentence[:320]
            card_difficulty = difficulty if difficulty != "medium" else _difficulty_from_text(sentence)
            dedupe_key = f"{chunk.topic_label}:{answer}"
            if dedupe_key in seen_questions:
                continue
            seen_questions.add(dedupe_key)

            existing = db.scalar(
                select(Flashcard).where(
                    Flashcard.user_id == user_id,
                    Flashcard.topic_name == chunk.topic_label,
                    Flashcard.answer == answer,
                )
            )
            if existing is not None:
                created.append(existing)
            else:
                flashcard = Flashcard(
                    user_id=user_id,
                    topic_name=chunk.topic_label,
                    question=prompt,
                    answer=answer,
                    difficulty=card_difficulty,
                )
                db.add(flashcard)
                db.flush()
                created.append(flashcard)

            _upsert_mastery(db, user_id, chunk.topic_label, delta=0.8)
            if len(created) >= count:
                db.commit()
                return FlashcardGenerateResponse(
                    message="Flashcards generated successfully.",
                    items=[FlashcardItem.model_validate(card) for card in created[:count]],
                )

    db.commit()
    return FlashcardGenerateResponse(
        message="Flashcards generated successfully.",
        items=[FlashcardItem.model_validate(card) for card in created[:count]],
    )


def list_flashcards(db: Session, user_id: int, topic: str | None = None) -> FlashcardListResponse:
    query = select(Flashcard).where(Flashcard.user_id == user_id).order_by(Flashcard.created_at.desc())
    if topic:
        query = query.where(Flashcard.topic_name == topic)
    items = db.scalars(query.limit(50)).all()
    return FlashcardListResponse(items=[FlashcardItem.model_validate(item) for item in items])


def rate_flashcard(db: Session, user_id: int, flashcard_id: int, rating: str) -> FlashcardItem:
    flashcard = db.scalar(
        select(Flashcard).where(Flashcard.user_id == user_id, Flashcard.id == flashcard_id)
    )
    if flashcard is None:
        raise ValueError("Flashcard not found.")

    flashcard.student_rating = rating
    delta = {"easy": 2.0, "medium": 0.8, "hard": -1.8}[rating]
    _upsert_mastery(db, user_id, flashcard.topic_name, delta=delta)
    db.commit()
    db.refresh(flashcard)
    return FlashcardItem.model_validate(flashcard)


def _sign_answer_payload(payload: dict[str, Any]) -> str:
    return serializer.dumps(payload)


def _unsign_answer_payload(token: str) -> dict[str, Any]:
    try:
        return serializer.loads(token)
    except BadSignature as exc:
        raise ValueError("Invalid answer token.") from exc


def _build_question(
    topic: str,
    sentence: str,
    all_topics: list[str],
    difficulty: str,
    question_type: str,
) -> QuizQuestion | None:
    if question_type == "multiple_choice":
        distractors = [label for label in all_topics if label != topic][:3]
        option_labels = [topic, *distractors]
        random.shuffle(option_labels)
        options = [QuestionOption(id=str(index + 1), label=label) for index, label in enumerate(option_labels)]
        correct_answer = next(option.id for option in options if option.label == topic)
        prompt = f"Which topic best matches this study clue? {sentence}"
        payload = {"type": question_type, "correct_answer": correct_answer, "topic_name": topic}
        return QuizQuestion(
            prompt=prompt,
            question_type="multiple_choice",
            topic_name=topic,
            difficulty=difficulty,
            options=options,
            source_snippet=sentence,
            answer_token=_sign_answer_payload(payload),
        )

    if question_type == "true_false":
        statement = f"{topic} is directly connected to this idea: {sentence}"
        if len(all_topics) > 1 and random.random() > 0.5:
            false_topic = next(label for label in all_topics if label != topic)
            statement = f"{false_topic} is directly connected to this idea: {sentence}"
            correct_answer = "false"
        else:
            correct_answer = "true"
        payload = {"type": question_type, "correct_answer": correct_answer, "topic_name": topic}
        return QuizQuestion(
            prompt=statement,
            question_type="true_false",
            topic_name=topic,
            difficulty=difficulty,
            options=[QuestionOption(id="true", label="True"), QuestionOption(id="false", label="False")],
            source_snippet=sentence,
            answer_token=_sign_answer_payload(payload),
        )

    if question_type == "fill_blank":
        if topic.lower() not in sentence.lower():
            sentence = f"{topic} is a key idea from the uploaded material. {sentence}"
        blanked = re.sub(re.escape(topic), "_____", sentence, flags=re.IGNORECASE, count=1)
        payload = {"type": question_type, "correct_answer": topic, "topic_name": topic}
        return QuizQuestion(
            prompt=f"Fill in the blank: {blanked}",
            question_type="fill_blank",
            topic_name=topic,
            difficulty=difficulty,
            options=[],
            source_snippet=sentence,
            answer_token=_sign_answer_payload(payload),
        )

    keywords = list(dict.fromkeys(_tokens(sentence)))[:4]
    if not keywords:
        return None
    payload = {"type": "short_answer", "keywords": keywords, "topic_name": topic, "correct_answer": ", ".join(keywords)}
    return QuizQuestion(
        prompt=f"In one short phrase, describe an important idea about {topic}.",
        question_type="short_answer",
        topic_name=topic,
        difficulty=difficulty,
        options=[],
        source_snippet=sentence,
        answer_token=_sign_answer_payload(payload),
    )


def generate_quiz(
    db: Session,
    user_id: int,
    question_count: int,
    difficulty: str,
    topic: str | None = None,
) -> QuizGenerateResponse:
    chunks = retrieve_relevant_chunks(
        db,
        user_id=user_id,
        question=topic or "practice quiz review important concepts",
        limit=max(question_count * 2, 8),
        topic=topic,
    )
    if not chunks:
        return QuizGenerateResponse(message="No indexed study material available yet.", questions=[])

    all_topics = list(dict.fromkeys(chunk.topic_label for chunk in chunks))
    questions: list[QuizQuestion] = []
    seen_prompts: set[str] = set()
    chunk_sentences: list[tuple[DocumentChunk, str]] = []
    for chunk in chunks:
        sentences = _sentence_split(chunk.chunk_text) or [chunk.chunk_text[:320]]
        for sentence in sentences[:3]:
            chunk_sentences.append((chunk, sentence[:320]))

    for index, (chunk, sentence) in enumerate(chunk_sentences):
        for type_offset in range(len(QUESTION_TYPES)):
            question_type = QUESTION_TYPES[(index + type_offset) % len(QUESTION_TYPES)]
            question = _build_question(chunk.topic_label, sentence, all_topics, difficulty, question_type)
            if question is None or question.prompt in seen_prompts:
                continue
            seen_prompts.add(question.prompt)
            questions.append(question)
            if len(questions) >= question_count:
                return QuizGenerateResponse(message="Quiz generated successfully.", questions=questions)

    return QuizGenerateResponse(message="Quiz generated successfully.", questions=questions)


def _evaluate_submission(answer_token: str, student_answer: str) -> tuple[bool, str, str]:
    payload = _unsign_answer_payload(answer_token)
    question_type = payload["type"]
    normalized = student_answer.strip().lower()

    if question_type in {"multiple_choice", "true_false", "fill_blank"}:
        correct = str(payload["correct_answer"]).strip().lower()
        is_correct = normalized == correct
        feedback = "Correct." if is_correct else "Review the source snippet and retry this concept."
        return is_correct, str(payload["correct_answer"]), feedback

    keywords = payload.get("keywords", [])
    hits = sum(1 for keyword in keywords if keyword in normalized)
    is_correct = hits >= max(1, math.ceil(len(keywords) / 2))
    feedback = "Good recall." if is_correct else "Try mentioning the core idea or term more explicitly."
    return is_correct, str(payload.get("correct_answer", "")), feedback


def submit_quiz(db: Session, user_id: int, answers: list[dict[str, Any]]) -> QuizSubmitResponse:
    if not answers:
        return QuizSubmitResponse(
            score_percent=0.0,
            correct_count=0,
            total_questions=0,
            weak_topics=[],
            results=[],
        )

    results: list[QuizResultItem] = []
    correct_count = 0
    topic_stats: defaultdict[str, list[bool]] = defaultdict(list)

    for answer in answers:
        is_correct, correct_answer, feedback = _evaluate_submission(answer["answer_token"], answer["student_answer"])
        if is_correct:
            correct_count += 1
        topic_stats[answer["topic_name"]].append(is_correct)
        delta = 3.5 if is_correct else -3.0
        _upsert_mastery(db, user_id, answer["topic_name"], delta=delta)
        db.add(
            QuizAttempt(
                user_id=user_id,
                topic_name=answer["topic_name"],
                question=answer["prompt"],
                student_answer=answer["student_answer"],
                correct_answer=correct_answer,
                is_correct=is_correct,
                difficulty=answer["difficulty"],
            )
        )
        results.append(
            QuizResultItem(
                prompt=answer["prompt"],
                topic_name=answer["topic_name"],
                student_answer=answer["student_answer"],
                correct_answer=correct_answer,
                is_correct=is_correct,
                feedback=feedback,
            )
        )

    db.commit()

    weak_topics = [
        topic
        for topic, answers_for_topic in topic_stats.items()
        if sum(1 for item in answers_for_topic if item) / len(answers_for_topic) < 0.6
    ]
    total_questions = len(answers)
    score_percent = round((correct_count / total_questions) * 100, 1)
    return QuizSubmitResponse(
        score_percent=score_percent,
        correct_count=correct_count,
        total_questions=total_questions,
        weak_topics=weak_topics,
        results=results,
    )


def start_exam(
    db: Session,
    user_id: int,
    question_count: int,
    minutes: int,
) -> ExamStartResponse:
    quiz = generate_quiz(
        db=db,
        user_id=user_id,
        question_count=question_count,
        difficulty="hard",
        topic=None,
    )
    return ExamStartResponse(
        message="Exam session created successfully.",
        duration_minutes=minutes,
        questions=quiz.questions,
    )


def submit_exam(
    db: Session,
    user_id: int,
    answers: list[dict[str, Any]],
    duration_minutes: int,
) -> ExamSubmitResponse:
    quiz_result = submit_quiz(db, user_id, answers)
    strong_topics = list(
        {
            result.topic_name
            for result in quiz_result.results
            if result.is_correct
        }
    )[:4]
    readiness_score = round(min(99.0, quiz_result.score_percent * 0.7 + max(0, 30 - duration_minutes) * 0.6), 1)
    feedback = [
        f"Exam score: {quiz_result.score_percent}%.",
        f"Estimated readiness: {readiness_score}%.",
        "Review weak topics with flashcards, then rerun a mixed quiz before the next exam simulation.",
    ]
    return ExamSubmitResponse(
        score_percent=quiz_result.score_percent,
        readiness_score=readiness_score,
        strong_topics=strong_topics,
        weak_topics=quiz_result.weak_topics,
        feedback=feedback,
        results=quiz_result.results,
    )
