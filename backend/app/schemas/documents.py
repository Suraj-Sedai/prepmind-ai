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

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentRead]


class UploadResponse(BaseModel):
    message: str
    document: DocumentRead
    topics_detected: list[str]
