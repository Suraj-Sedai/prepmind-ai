import json
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
from app.rag.chunking import process_document
from app.rag.embeddings import EmbeddingProviderUnavailable, embed_texts, serialize_vector
from app.schemas.documents import DeleteDocumentResponse, DocumentListResponse, DocumentRead, UploadResponse
from app.utils.files import sanitize_filename

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_SUFFIXES = {".pdf", ".txt", ".md", ".docx"}
settings = get_settings()
MAX_UPLOAD_SIZE_BYTES = settings.max_upload_size_mb * 1024 * 1024


def remove_document_file(path_value: str) -> None:
    path = Path(path_value)
    if path.exists():
        path.unlink()


def remove_existing_document(document: Document, db: Session) -> None:
    for thread in document.chat_threads:
        thread.document_id = None
    remove_document_file(document.stored_path)
    db.delete(document)


def ensure_user_storage_dir(user_id: int) -> Path:
    user_dir = settings.upload_path / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


@router.get("", response_model=DocumentListResponse)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    items = db.scalars(
        select(Document).where(Document.user_id == current_user.id).order_by(Document.upload_date.desc())
    ).all()
    return DocumentListResponse(items=items)


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentRead:
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.delete("/{document_id}", response_model=DeleteDocumentResponse)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeleteDocumentResponse:
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    remove_existing_document(document, db)
    db.commit()
    return DeleteDocumentResponse(message="Document deleted successfully.", document_id=document_id)


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_name: str = Form(default="General"),
    replace_existing: bool = Form(default=False),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    original_name = file.filename or "document"
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, TXT, or MD.")

    course_label = course_name.strip() or "General"
    if len(course_label) > 120:
        raise HTTPException(status_code=400, detail="Course label must be 120 characters or fewer.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.max_upload_size_mb} MB upload limit.",
        )

    existing_document = db.scalar(
        select(Document).where(
            Document.user_id == current_user.id,
            Document.document_name == original_name,
            Document.course_name == course_label,
        )
    )
    if existing_document is not None and not replace_existing:
        raise HTTPException(
            status_code=409,
            detail="A document with the same name already exists for this course. Delete it or upload with replace enabled.",
        )
    if existing_document is not None:
        remove_existing_document(existing_document, db)
        db.flush()

    upload_dir = ensure_user_storage_dir(current_user.id)
    stored_name = f"{uuid4().hex}-{sanitize_filename(original_name)}"
    stored_path = upload_dir / stored_name

    document = Document(
        user_id=current_user.id,
        document_name=original_name,
        document_type=suffix.lstrip("."),
        course_name=course_label,
        stored_path=str(stored_path.resolve()),
        processing_status="uploaded",
        chunk_count=0,
        file_size_bytes=len(file_bytes),
        extracted_word_count=0,
        topic_summary="",
        error_message=None,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        stored_path.write_bytes(file_bytes)
        document.processing_status = "processing"
        db.commit()

        processed = process_document(stored_path)
        if processed.scanned_or_empty:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file appears to be scanned or contains no extractable text. OCR is not available yet.",
            )
        if processed.word_count < 40 or not processed.chunks:
            raise HTTPException(status_code=400, detail="The uploaded file does not contain enough readable text.")

        chunk_texts = [chunk.text for chunk in processed.chunks]
        chunk_vectors, embedding_model = embed_texts(chunk_texts, task_type="RETRIEVAL_DOCUMENT")

        document.processing_status = "ready"
        document.chunk_count = len(processed.chunks)
        document.extracted_word_count = processed.word_count
        document.topic_summary = ", ".join(processed.topics[:5])
        document.error_message = None

        for index, chunk in enumerate(processed.chunks):
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    chunk_text=chunk.text,
                    topic_label=chunk.topic_label or "General",
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    section_heading=chunk.section_heading,
                    content_type=chunk.content_type,
                    importance_score=chunk.importance_score,
                    metadata_json=json.dumps(chunk.metadata),
                    chunk_word_count=len(chunk.text.split()),
                    embedding_vector=serialize_vector(chunk_vectors[index]) if index < len(chunk_vectors) else None,
                    embedding_model=embedding_model,
                    embedding_norm="l2",
                )
            )

        for order, topic in enumerate(processed.topics):
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
            topics_detected=processed.topics,
        )
    except EmbeddingProviderUnavailable as exc:
        document.processing_status = "failed"
        document.error_message = str(exc)
        db.commit()
        remove_document_file(str(stored_path))
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPException as exc:
        document.processing_status = "failed"
        document.error_message = exc.detail
        db.commit()
        remove_document_file(str(stored_path))
        raise
    except Exception:
        document.processing_status = "failed"
        document.error_message = "Processing failed while extracting or chunking the uploaded file."
        db.commit()
        remove_document_file(str(stored_path))
        raise HTTPException(
            status_code=500,
            detail="Processing failed while extracting or chunking the uploaded file.",
        )
