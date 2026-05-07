from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CitationItem(BaseModel):
    document_name: str
    file_name: str | None = None
    topic_label: str
    snippet: str
    page_start: int | None = None
    page_end: int | None = None
    page_or_slide: str | None = None
    relevance: float | None = None


class AskRequest(BaseModel):
    question: str = Field(min_length=4, max_length=500)
    document_id: int | None = None


class AskResponse(BaseModel):
    answer_status: Literal["answered_from_documents", "not_found_in_documents", "general_ai_fallback"]
    answer: str
    sources: list[CitationItem]
    citations: list[CitationItem]
    confidence: float
    confidence_label: Literal["high", "medium", "low", "general"]
    used_general_ai: bool


class RecommendationItem(BaseModel):
    topic: str
    reason: str
    action: str


class DashboardStat(BaseModel):
    label: str
    value: str
    tone: str = "neutral"


class DocumentSnapshot(BaseModel):
    id: int
    name: str
    course_name: str
    upload_date: datetime
    chunk_count: int


class TopicMasteryItem(BaseModel):
    topic_name: str
    mastery_score: float
    study_frequency: int
    last_reviewed: datetime


class DashboardResponse(BaseModel):
    stats: list[DashboardStat]
    recent_documents: list[DocumentSnapshot]
    weak_topics: list[TopicMasteryItem]
    recommendations: list[RecommendationItem]


class ProgressResponse(BaseModel):
    readiness_score: float
    study_streak_days: int
    topic_mastery: list[TopicMasteryItem]
    recent_activity: list[str]
    quiz_accuracy: float
    flashcard_coverage: int


class FlashcardItem(BaseModel):
    id: int
    topic_name: str
    question: str
    answer: str
    difficulty: str
    student_rating: str | None = None
    source_document_name: str | None = None
    source_page_start: int | None = None
    source_snippet: str | None = None

    model_config = {"from_attributes": True}


class FlashcardGenerateRequest(BaseModel):
    topic: str | None = None
    count: int = Field(default=6, ge=1, le=20)
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class FlashcardListResponse(BaseModel):
    items: list[FlashcardItem]


class FlashcardGenerateResponse(BaseModel):
    message: str
    items: list[FlashcardItem]


class FlashcardRateRequest(BaseModel):
    rating: Literal["easy", "medium", "hard"]


class QuestionOption(BaseModel):
    id: str
    label: str


class QuizQuestion(BaseModel):
    prompt: str
    question_type: Literal["multiple_choice", "true_false", "fill_blank", "short_answer"]
    topic_name: str
    difficulty: str
    options: list[QuestionOption] = []
    source_snippet: str
    source_document_name: str | None = None
    source_page_start: int | None = None
    answer_token: str


class QuizGenerateRequest(BaseModel):
    topic: str | None = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_count: int = Field(default=5, ge=1, le=20)


class QuizGenerateResponse(BaseModel):
    message: str
    questions: list[QuizQuestion]


class QuizAnswerSubmission(BaseModel):
    prompt: str
    topic_name: str
    question_type: str
    difficulty: str
    answer_token: str
    student_answer: str


class QuizSubmitRequest(BaseModel):
    answers: list[QuizAnswerSubmission]


class QuizResultItem(BaseModel):
    prompt: str
    topic_name: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    feedback: str


class QuizSubmitResponse(BaseModel):
    score_percent: float
    correct_count: int
    total_questions: int
    weak_topics: list[str]
    results: list[QuizResultItem]


class ExamStartRequest(BaseModel):
    question_count: int = Field(default=10, ge=3, le=30)
    minutes: int = Field(default=20, ge=5, le=120)


class ExamStartResponse(BaseModel):
    message: str
    duration_minutes: int
    questions: list[QuizQuestion]


class ExamSubmitRequest(BaseModel):
    answers: list[QuizAnswerSubmission]
    duration_minutes: int


class ExamSubmitResponse(BaseModel):
    score_percent: float
    readiness_score: float
    strong_topics: list[str]
    weak_topics: list[str]
    feedback: list[str]
    results: list[QuizResultItem]
