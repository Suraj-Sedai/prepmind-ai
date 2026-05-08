from __future__ import annotations

import math
import random
import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import DocumentChunk
from app.models.study import Flashcard, QuizAttempt, TopicMastery
from app.rag.answer import answer_question_with_rag
from app.rag.retrieval import retrieve_relevant_chunks as retrieve_rag_chunks
from app.schemas.study import (
    AskResponse,
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
from app.services.study_generation import generate_flashcards_with_ai, generate_quiz_with_ai

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


def _sentence_split(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [sentence.strip() for sentence in sentences if len(sentence.strip().split()) >= 7]


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


def answer_question(db: Session, user_id: int, question: str, document_id: Optional[int] = None) -> AskResponse:
    response = answer_question_with_rag(db, user_id=user_id, question=question, document_id=document_id)
    if response.answer_status == "answered_from_documents":
        for source in response.sources:
            if source.topic_label != "General AI knowledge":
                _upsert_mastery(db, user_id, source.topic_label, delta=2.0)
        db.commit()
    return response


def _difficulty_from_text(text: str) -> str:
    words = len(text.split())
    if words < 14:
        return "easy"
    if words < 26:
        return "medium"
    return "hard"


def _flashcard_dedupe_key(topic_name: str, answer: str) -> str:
    return f"{topic_name.strip().lower()}:{' '.join(answer.lower().split())}"


def _persist_generated_flashcard(
    db: Session,
    user_id: int,
    item: dict[str, Any],
    seen_questions: set[str],
) -> Optional[Flashcard]:
    question = str(item["question"]).strip()
    answer = str(item["answer"]).strip()
    topic_name = str(item["topic_name"]).strip() or "General"
    dedupe_key = _flashcard_dedupe_key(topic_name, answer)
    if dedupe_key in seen_questions:
        return None
    seen_questions.add(dedupe_key)

    existing = db.scalar(
        select(Flashcard).where(
            Flashcard.user_id == user_id,
            Flashcard.topic_name == topic_name,
            Flashcard.answer == answer,
        )
    )
    if existing is not None:
        existing.question = existing.question or question
        existing.source_document_name = existing.source_document_name or item.get("source_document_name")
        existing.source_page_start = existing.source_page_start or item.get("source_page_start")
        existing.source_snippet = existing.source_snippet or item.get("source_snippet")
        return existing

    flashcard = Flashcard(
        user_id=user_id,
        topic_name=topic_name,
        question=question,
        answer=answer,
        difficulty=str(item.get("difficulty") or "medium"),
        source_document_name=item.get("source_document_name"),
        source_page_start=item.get("source_page_start"),
        source_snippet=item.get("source_snippet"),
    )
    db.add(flashcard)
    db.flush()
    return flashcard


def generate_flashcards(
    db: Session,
    user_id: int,
    count: int,
    difficulty: str,
    topic: Optional[str] = None,
) -> FlashcardGenerateResponse:
    chunks = retrieve_rag_chunks(
        db,
        user_id=user_id,
        question=topic or "important concepts key ideas exam review",
        top_k=max(count * 2, 12),
        final_limit=max(count, 6),
        topic=topic,
    )
    if not chunks:
        return FlashcardGenerateResponse(message="No indexed study material available yet.", items=[])

    created: list[Flashcard] = []
    seen_questions: set[str] = set()
    ai_items = generate_flashcards_with_ai(chunks, count, difficulty, topic)
    for item in ai_items:
        flashcard = _persist_generated_flashcard(db, user_id, item, seen_questions)
        if flashcard is None:
            continue
        created.append(flashcard)
        _upsert_mastery(db, user_id, flashcard.topic_name, delta=0.8)
        if len(created) >= count:
            db.commit()
            return FlashcardGenerateResponse(
                message="AI flashcards generated successfully.",
                items=[FlashcardItem.model_validate(card) for card in created[:count]],
            )

    for chunk in chunks:
        for sentence in _sentence_split(chunk.chunk_text):
            prompt = f"What should you remember about {chunk.topic_label}?"
            answer = sentence[:320]
            card_difficulty = difficulty if difficulty != "medium" else _difficulty_from_text(sentence)
            dedupe_key = _flashcard_dedupe_key(chunk.topic_label, answer)
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
                existing.source_document_name = existing.source_document_name or chunk.document.document_name
                existing.source_page_start = existing.source_page_start or chunk.page_start
                existing.source_snippet = existing.source_snippet or sentence[:320]
                created.append(existing)
            else:
                flashcard = Flashcard(
                    user_id=user_id,
                    topic_name=chunk.topic_label,
                    question=prompt,
                    answer=answer,
                    difficulty=card_difficulty,
                    source_document_name=chunk.document.document_name,
                    source_page_start=chunk.page_start,
                    source_snippet=sentence[:320],
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


def list_flashcards(db: Session, user_id: int, topic: Optional[str] = None) -> FlashcardListResponse:
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
) -> Optional[QuizQuestion]:
    if question_type == "multiple_choice":
        distractors = [label for label in all_topics if label != topic][:3]
        option_labels = [topic, *distractors]
        random.shuffle(option_labels)
        options = [QuestionOption(id=str(index + 1), label=label) for index, label in enumerate(option_labels)]
        correct_answer = next(option.id for option in options if option.label == topic)
        prompt = f"Which topic best matches this study clue? {sentence}"
        explanation = f"The clue comes from the uploaded material about {topic}."
        payload = {"type": question_type, "correct_answer": correct_answer, "topic_name": topic, "explanation": explanation}
        return QuizQuestion(
            prompt=prompt,
            question_type="multiple_choice",
            topic_name=topic,
            difficulty=difficulty,
            options=options,
            source_snippet=sentence,
            explanation=explanation,
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
        explanation = f"The statement should be checked against the source idea for {topic}."
        payload = {"type": question_type, "correct_answer": correct_answer, "topic_name": topic, "explanation": explanation}
        return QuizQuestion(
            prompt=statement,
            question_type="true_false",
            topic_name=topic,
            difficulty=difficulty,
            options=[QuestionOption(id="true", label="True"), QuestionOption(id="false", label="False")],
            source_snippet=sentence,
            explanation=explanation,
            answer_token=_sign_answer_payload(payload),
        )

    if question_type == "fill_blank":
        if topic.lower() not in sentence.lower():
            sentence = f"{topic} is a key idea from the uploaded material. {sentence}"
        blanked = re.sub(re.escape(topic), "_____", sentence, flags=re.IGNORECASE, count=1)
        explanation = f"The missing term is the topic connected to this source idea: {topic}."
        payload = {"type": question_type, "correct_answer": topic, "topic_name": topic, "explanation": explanation}
        return QuizQuestion(
            prompt=f"Fill in the blank: {blanked}",
            question_type="fill_blank",
            topic_name=topic,
            difficulty=difficulty,
            options=[],
            source_snippet=sentence,
            explanation=explanation,
            answer_token=_sign_answer_payload(payload),
        )

    keywords = list(dict.fromkeys(_tokens(sentence)))[:4]
    if not keywords:
        return None
    explanation = f"A strong answer should mention the core terms from the source: {', '.join(keywords)}."
    payload = {
        "type": "short_answer",
        "keywords": keywords,
        "topic_name": topic,
        "correct_answer": ", ".join(keywords),
        "explanation": explanation,
    }
    return QuizQuestion(
        prompt=f"In one short phrase, describe an important idea about {topic}.",
        question_type="short_answer",
        topic_name=topic,
        difficulty=difficulty,
        options=[],
        source_snippet=sentence,
        explanation=explanation,
        answer_token=_sign_answer_payload(payload),
    )


def _quiz_question_from_ai(item: dict[str, Any]) -> QuizQuestion:
    question_type = str(item["question_type"])
    correct_answer = str(item["correct_answer"])
    explanation = str(item.get("explanation") or "Review the source snippet for this concept.")
    payload = {
        "type": question_type,
        "correct_answer": correct_answer,
        "topic_name": item["topic_name"],
        "explanation": explanation,
    }
    if question_type == "short_answer":
        payload["keywords"] = _tokens(correct_answer)
    return QuizQuestion(
        prompt=str(item["prompt"]),
        question_type=question_type,  # type: ignore[arg-type]
        topic_name=str(item["topic_name"]),
        difficulty=str(item["difficulty"]),
        options=[QuestionOption(**option) for option in item.get("options", [])],
        source_snippet=str(item.get("source_snippet") or ""),
        source_document_name=item.get("source_document_name"),
        source_page_start=item.get("source_page_start"),
        explanation=explanation,
        answer_token=_sign_answer_payload(payload),
    )


def generate_quiz(
    db: Session,
    user_id: int,
    question_count: int,
    difficulty: str,
    topic: Optional[str] = None,
) -> QuizGenerateResponse:
    chunks = retrieve_rag_chunks(
        db,
        user_id=user_id,
        question=topic or "practice quiz review important concepts",
        top_k=max(question_count * 3, 12),
        final_limit=max(question_count * 2, 8),
        topic=topic,
    )
    if not chunks:
        return QuizGenerateResponse(message="No indexed study material available yet.", questions=[])

    questions: list[QuizQuestion] = []
    seen_prompts: set[str] = set()
    ai_items = generate_quiz_with_ai(chunks, question_count, difficulty, topic)
    for item in ai_items:
        question = _quiz_question_from_ai(item)
        if question.prompt in seen_prompts:
            continue
        seen_prompts.add(question.prompt)
        questions.append(question)
        if len(questions) >= question_count:
            return QuizGenerateResponse(message="AI quiz generated successfully.", questions=questions)

    all_topics = list(dict.fromkeys(chunk.topic_label for chunk in chunks))
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
            question.source_document_name = chunk.document.document_name
            question.source_page_start = chunk.page_start
            seen_prompts.add(question.prompt)
            questions.append(question)
            if len(questions) >= question_count:
                return QuizGenerateResponse(message="Quiz generated successfully.", questions=questions)

    return QuizGenerateResponse(message="Quiz generated successfully.", questions=questions)


def _evaluate_submission(answer_token: str, student_answer: str) -> tuple[bool, str, str, str]:
    payload = _unsign_answer_payload(answer_token)
    question_type = payload["type"]
    normalized = student_answer.strip().lower()
    explanation = str(payload.get("explanation") or "Review the source snippet for this concept.")

    if question_type in {"multiple_choice", "true_false", "fill_blank"}:
        correct = str(payload["correct_answer"]).strip().lower()
        is_correct = normalized == correct
        feedback = "Correct." if is_correct else explanation
        return is_correct, str(payload["correct_answer"]), feedback, explanation

    keywords = payload.get("keywords", [])
    if keywords:
        hits = sum(1 for keyword in keywords if keyword in normalized)
        is_correct = hits >= max(1, math.ceil(len(keywords) / 2))
    else:
        correct_text = str(payload.get("correct_answer", "")).strip().lower()
        is_correct = bool(correct_text and (normalized == correct_text or correct_text in normalized))
    feedback = "Good recall." if is_correct else explanation
    return is_correct, str(payload.get("correct_answer", "")), feedback, explanation


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
        is_correct, correct_answer, feedback, explanation = _evaluate_submission(answer["answer_token"], answer["student_answer"])
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
                explanation=explanation,
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
