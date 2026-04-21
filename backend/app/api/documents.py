from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.models.study import TopicMastery
from app.models.user import User
from app.schemas.documents import DocumentListResponse, UploadResponse
from app.services.document_processor import (
    choose_chunk_topic,
    chunk_text,
    clean_text,
    extract_text,
    extract_topics,
)

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_SUFFIXES = {".pdf", ".txt", ".docx"}
settings = get_settings()


@router.get("", response_model=DocumentListResponse)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    items = db.scalars(
        select(Document).where(Document.user_id == current_user.id).order_by(Document.upload_date.desc())
    ).all()
    return DocumentListResponse(items=items)


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_name: str = Form(default="General"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, TXT, or DOCX.")

    upload_dir = settings.upload_path
    upload_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid4().hex}{suffix}"
    stored_path = upload_dir / stored_name
    stored_path.write_bytes(await file.read())

    raw_text = extract_text(stored_path)
    cleaned = clean_text(raw_text)
    if len(cleaned.split()) < 40:
        raise HTTPException(status_code=400, detail="The uploaded file does not contain enough readable text.")

    detected_topics = extract_topics(cleaned)
    chunks = chunk_text(cleaned)

    document = Document(
        user_id=current_user.id,
        document_name=file.filename or stored_name,
        document_type=suffix.lstrip("."),
        course_name=course_name.strip() or "General",
        stored_path=str(stored_path.resolve()),
        chunk_count=len(chunks),
    )
    db.add(document)
    db.flush()

    for index, chunk in enumerate(chunks):
        topic = choose_chunk_topic(chunk, detected_topics)
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_index=index,
                chunk_text=chunk,
                topic_label=topic,
                chunk_word_count=len(chunk.split()),
            )
        )

    for order, topic in enumerate(detected_topics):
        mastery = db.scalar(
            select(TopicMastery).where(
                TopicMastery.user_id == current_user.id,
                TopicMastery.topic_name == topic,
            )
        )
        if mastery is None:
            db.add(
                TopicMastery(
                    user_id=current_user.id,
                    topic_name=topic,
                    mastery_score=max(30.0, 52.0 - order * 6),
                    study_frequency=1,
                )
            )
        else:
            mastery.study_frequency += 1

    db.commit()
    db.refresh(document)

    return UploadResponse(
        message="Document uploaded and processed successfully.",
        document=document,
        topics_detected=detected_topics,
    )
