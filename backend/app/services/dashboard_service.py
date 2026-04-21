from datetime import datetime, timedelta

from sqlalchemy import Float, func, select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.models.study import Flashcard, QuizAttempt, TopicMastery
from app.schemas.study import (
    DashboardResponse,
    DashboardStat,
    DocumentSnapshot,
    ProgressResponse,
    RecommendationItem,
    TopicMasteryItem,
)


def _topic_items(rows: list[TopicMastery]) -> list[TopicMasteryItem]:
    return [
        TopicMasteryItem(
            topic_name=row.topic_name,
            mastery_score=round(row.mastery_score, 1),
            study_frequency=row.study_frequency,
            last_reviewed=row.last_reviewed,
        )
        for row in rows
    ]


def build_recommendations(topic_rows: list[TopicMastery]) -> list[RecommendationItem]:
    recommendations: list[RecommendationItem] = []
    for row in topic_rows[:4]:
        if row.mastery_score < 50:
            reason = "Low mastery and limited reinforcement so far."
            action = "Review flashcards, then run a focused quiz."
        elif row.mastery_score < 75:
            reason = "Mid-range mastery with room to deepen recall."
            action = "Schedule a mixed-difficulty practice session."
        else:
            reason = "Strong performance that can support challenge mode."
            action = "Promote this topic into exam simulation rotation."

        recommendations.append(
            RecommendationItem(
                topic=row.topic_name,
                reason=reason,
                action=action,
            )
        )
    return recommendations


def build_dashboard(db: Session, user_id: int) -> DashboardResponse:
    documents = db.scalars(
        select(Document).where(Document.user_id == user_id).order_by(Document.upload_date.desc()).limit(5)
    ).all()
    topic_rows = db.scalars(
        select(TopicMastery).where(TopicMastery.user_id == user_id).order_by(TopicMastery.mastery_score.asc())
    ).all()
    chunk_total = db.scalar(
        select(func.count(DocumentChunk.id))
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.user_id == user_id)
    ) or 0
    quiz_accuracy = db.scalar(
        select(func.avg(func.cast(QuizAttempt.is_correct, Float)))
        .where(QuizAttempt.user_id == user_id)
    )
    flashcard_total = db.scalar(
        select(func.count(Flashcard.id)).where(Flashcard.user_id == user_id)
    ) or 0

    readiness = 0.0
    if topic_rows:
        readiness = sum(row.mastery_score for row in topic_rows) / len(topic_rows)

    stats = [
        DashboardStat(label="Documents", value=str(len(documents)), tone="neutral"),
        DashboardStat(label="Chunks Indexed", value=str(chunk_total), tone="info"),
        DashboardStat(label="Tracked Topics", value=str(len(topic_rows)), tone="neutral"),
        DashboardStat(label="Readiness", value=f"{round(readiness)}%", tone="accent"),
        DashboardStat(
            label="Quiz Accuracy",
            value=f"{round((quiz_accuracy or 0) * 100)}%",
            tone="success",
        ),
        DashboardStat(label="Flashcards", value=str(flashcard_total), tone="info"),
    ]

    return DashboardResponse(
        stats=stats,
        recent_documents=[
            DocumentSnapshot(
                id=doc.id,
                name=doc.document_name,
                course_name=doc.course_name,
                upload_date=doc.upload_date,
                chunk_count=doc.chunk_count,
            )
            for doc in documents
        ],
        weak_topics=_topic_items(topic_rows[:5]),
        recommendations=build_recommendations(topic_rows),
    )


def build_progress(db: Session, user_id: int) -> ProgressResponse:
    topic_rows = db.scalars(
        select(TopicMastery).where(TopicMastery.user_id == user_id).order_by(TopicMastery.mastery_score.asc())
    ).all()
    readiness = round(
        sum(topic.mastery_score for topic in topic_rows) / len(topic_rows),
        1,
    ) if topic_rows else 0.0

    recent_activity = []
    for topic in topic_rows[:5]:
        recent_activity.append(
            f"{topic.topic_name}: mastery {round(topic.mastery_score)}% after {topic.study_frequency} review cycle(s)"
        )

    streak_cutoff = datetime.utcnow() - timedelta(days=7)
    streak_days = sum(1 for topic in topic_rows if topic.last_reviewed >= streak_cutoff)
    quiz_accuracy = db.scalar(
        select(func.avg(func.cast(QuizAttempt.is_correct, Float)))
        .where(QuizAttempt.user_id == user_id)
    ) or 0.0
    flashcard_coverage = db.scalar(
        select(func.count(Flashcard.id)).where(Flashcard.user_id == user_id)
    ) or 0

    return ProgressResponse(
        readiness_score=readiness,
        study_streak_days=streak_days,
        topic_mastery=_topic_items(topic_rows),
        recent_activity=recent_activity,
        quiz_accuracy=round(quiz_accuracy * 100, 1),
        flashcard_coverage=flashcard_coverage,
    )
