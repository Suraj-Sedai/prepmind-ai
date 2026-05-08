from __future__ import annotations

import json
from datetime import datetime
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.chat import ChatMessage, ChatThread
from app.models.document import Document
from app.models.user import User
from app.schemas.chat import (
    ChatAskRequest,
    ChatAskResponse,
    ChatMessageItem,
    ChatThreadCreateRequest,
    ChatThreadDetailResponse,
    ChatThreadItem,
    ChatThreadListResponse,
)
from app.schemas.study import CitationItem
from app.services.study_service import answer_question

router = APIRouter(prefix="/chat", tags=["chat"])


def _thread_title(question: str) -> str:
    compact = " ".join(question.split())
    if len(compact) <= 60:
        return compact or "New chat"
    return compact[:57].rstrip() + "..."


def _owned_document(db: Session, user_id: int, document_id: Optional[int]) -> Optional[Document]:
    if document_id is None:
        return None
    document = db.scalar(select(Document).where(Document.id == document_id, Document.user_id == user_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


def _owned_thread(db: Session, user_id: int, thread_id: int) -> ChatThread:
    thread = db.scalar(
        select(ChatThread)
        .options(selectinload(ChatThread.document), selectinload(ChatThread.messages))
        .where(ChatThread.id == thread_id, ChatThread.user_id == user_id)
    )
    if thread is None:
        raise HTTPException(status_code=404, detail="Chat thread not found.")
    return thread


def _serialize_citations(citations: list[CitationItem]) -> str:
    return json.dumps([citation.model_dump(mode="json") for citation in citations])


def _deserialize_citations(payload: Optional[str]) -> list[CitationItem]:
    if not payload:
        return []
    try:
        items = json.loads(payload)
    except json.JSONDecodeError:
        return []
    citations: list[CitationItem] = []
    for item in items if isinstance(items, list) else []:
        try:
            citations.append(CitationItem.model_validate(item))
        except Exception:
            continue
    return citations


def _thread_item(thread: ChatThread) -> ChatThreadItem:
    return ChatThreadItem(
        id=thread.id,
        title=thread.title,
        course_name=thread.course_name,
        document_id=thread.document_id,
        document_name=thread.document.document_name if thread.document else None,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


def _message_item(message: ChatMessage) -> ChatMessageItem:
    return ChatMessageItem(
        id=message.id,
        thread_id=message.thread_id,
        role=message.role,  # type: ignore[arg-type]
        content=message.content,
        answer_status=message.answer_status,  # type: ignore[arg-type]
        confidence_label=message.confidence_label,  # type: ignore[arg-type]
        used_general_ai=message.used_general_ai,
        citations=_deserialize_citations(message.citations_json),
        created_at=message.created_at,
    )


def _message_items(thread: ChatThread) -> list[ChatMessageItem]:
    return [_message_item(message) for message in sorted(thread.messages, key=lambda item: item.created_at)]


def _saved_message_items(db: Session, thread_id: int) -> list[ChatMessageItem]:
    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
    ).all()
    return [_message_item(message) for message in messages]


@router.get("/threads", response_model=ChatThreadListResponse)
def list_threads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadListResponse:
    threads = db.scalars(
        select(ChatThread)
        .options(selectinload(ChatThread.document))
        .where(ChatThread.user_id == current_user.id)
        .order_by(ChatThread.updated_at.desc())
    ).all()
    return ChatThreadListResponse(items=[_thread_item(thread) for thread in threads])


@router.post("/threads", response_model=ChatThreadDetailResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: ChatThreadCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadDetailResponse:
    document = _owned_document(db, current_user.id, payload.document_id)
    title = (payload.title or "").strip() or "New chat"
    course_name = (payload.course_name or "").strip() or (document.course_name if document else None)
    thread = ChatThread(
        user_id=current_user.id,
        title=title[:120],
        course_name=course_name,
        document_id=document.id if document else None,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    thread = _owned_thread(db, current_user.id, thread.id)
    return ChatThreadDetailResponse(thread=_thread_item(thread), messages=[])


@router.get("/threads/{thread_id}", response_model=ChatThreadDetailResponse)
def get_thread(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadDetailResponse:
    thread = _owned_thread(db, current_user.id, thread_id)
    return ChatThreadDetailResponse(thread=_thread_item(thread), messages=_message_items(thread))


@router.delete("/threads/{thread_id}")
def delete_thread(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Union[int, str]]:
    thread = _owned_thread(db, current_user.id, thread_id)
    db.delete(thread)
    db.commit()
    return {"message": "Chat thread deleted.", "thread_id": thread_id}


def _ask_in_thread(db: Session, current_user: User, thread: ChatThread, payload: ChatAskRequest) -> ChatAskResponse:
    document = _owned_document(db, current_user.id, payload.document_id) if payload.document_id is not None else None
    document_id = document.id if document else thread.document_id

    user_message = ChatMessage(
        thread_id=thread.id,
        user_id=current_user.id,
        role="user",
        content=payload.question.strip(),
    )
    db.add(user_message)
    db.flush()

    response = answer_question(db, current_user.id, payload.question, document_id)
    assistant_message = ChatMessage(
        thread_id=thread.id,
        user_id=current_user.id,
        role="assistant",
        content=response.answer,
        answer_status=response.answer_status,
        confidence_label=response.confidence_label,
        used_general_ai=response.used_general_ai,
        citations_json=_serialize_citations(response.citations),
    )
    db.add(assistant_message)

    if not thread.title or thread.title == "New chat":
        thread.title = _thread_title(payload.question)
    if document is not None:
        thread.document_id = document.id
        thread.course_name = document.course_name
    thread.updated_at = datetime.utcnow()
    db.commit()

    thread = _owned_thread(db, current_user.id, thread.id)
    saved_messages = _saved_message_items(db, thread.id)
    return ChatAskResponse(
        thread=_thread_item(thread),
        user_message=saved_messages[-2],
        assistant_message=saved_messages[-1],
        messages=saved_messages,
    )


@router.post("/threads/{thread_id}/ask", response_model=ChatAskResponse)
def ask_thread(
    thread_id: int,
    payload: ChatAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatAskResponse:
    thread = _owned_thread(db, current_user.id, thread_id)
    return _ask_in_thread(db, current_user, thread, payload)


@router.post("/ask", response_model=ChatAskResponse, status_code=status.HTTP_201_CREATED)
def create_thread_and_ask(
    payload: ChatAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatAskResponse:
    document = _owned_document(db, current_user.id, payload.document_id)
    thread = ChatThread(
        user_id=current_user.id,
        title="New chat",
        course_name=document.course_name if document else None,
        document_id=document.id if document else None,
    )
    db.add(thread)
    db.flush()
    return _ask_in_thread(db, current_user, thread, payload)
