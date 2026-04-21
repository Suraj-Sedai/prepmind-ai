from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TopicMastery(Base):
    __tablename__ = "topic_masteries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic_name: Mapped[str] = mapped_column(String(120), index=True)
    mastery_score: Mapped[float] = mapped_column(Float, default=45.0)
    last_reviewed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    study_frequency: Mapped[int] = mapped_column(default=1)

    user = relationship("User", back_populates="topic_masteries")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic_name: Mapped[str] = mapped_column(String(120), index=True)
    question: Mapped[str] = mapped_column(Text)
    student_answer: Mapped[str] = mapped_column(Text, default="")
    correct_answer: Mapped[str] = mapped_column(Text, default="")
    is_correct: Mapped[bool] = mapped_column(default=False)
    difficulty: Mapped[str] = mapped_column(String(32), default="medium")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_attempts")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic_name: Mapped[str] = mapped_column(String(120), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(32), default="medium")
    student_rating: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="flashcards")
