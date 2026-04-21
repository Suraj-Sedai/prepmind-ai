from datetime import datetime

from pydantic import BaseModel, Field


class CitationItem(BaseModel):
    document_name: str
    topic_label: str
    snippet: str


class AskRequest(BaseModel):
    question: str = Field(min_length=4, max_length=500)


class AskResponse(BaseModel):
    answer: str
    citations: list[CitationItem]
    confidence: float


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
