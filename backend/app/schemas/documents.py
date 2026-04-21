from datetime import datetime

from pydantic import BaseModel


class DocumentRead(BaseModel):
    id: int
    document_name: str
    document_type: str
    upload_date: datetime
    course_name: str
    processing_status: str
    chunk_count: int
    file_size_bytes: int
    extracted_word_count: int
    topic_summary: str
    error_message: str | None = None

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentRead]


class UploadResponse(BaseModel):
    message: str
    document: DocumentRead
    topics_detected: list[str]


class DeleteDocumentResponse(BaseModel):
    message: str
    document_id: int
