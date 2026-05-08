from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.study import CitationItem


class ChatThreadItem(BaseModel):
    id: int
    title: str
    course_name: Optional[str] = None
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ChatThreadListResponse(BaseModel):
    items: list[ChatThreadItem]


class ChatMessageItem(BaseModel):
    id: int
    thread_id: int
    role: Literal["user", "assistant"]
    content: str
    answer_status: Optional[Literal["answered_from_documents", "not_found_in_documents", "general_ai_fallback"]] = None
    confidence_label: Optional[Literal["high", "medium", "low", "general"]] = None
    used_general_ai: bool = False
    citations: list[CitationItem] = Field(default_factory=list)
    created_at: datetime


class ChatThreadDetailResponse(BaseModel):
    thread: ChatThreadItem
    messages: list[ChatMessageItem]


class ChatThreadCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    document_id: Optional[int] = None
    course_name: Optional[str] = Field(default=None, max_length=120)


class ChatAskRequest(BaseModel):
    question: str = Field(min_length=4, max_length=500)
    document_id: Optional[int] = None


class ChatAskResponse(BaseModel):
    thread: ChatThreadItem
    user_message: ChatMessageItem
    assistant_message: ChatMessageItem
    messages: list[ChatMessageItem]
