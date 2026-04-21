from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    document_name: Mapped[str] = mapped_column(String(255))
    document_type: Mapped[str] = mapped_column(String(32))
    upload_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    course_name: Mapped[str] = mapped_column(String(120), default="General")
    stored_path: Mapped[str] = mapped_column(String(512))
    processing_status: Mapped[str] = mapped_column(String(32), default="processed")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)

    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    chunk_text: Mapped[str] = mapped_column(Text)
    topic_label: Mapped[str] = mapped_column(String(120), default="General")
    chunk_word_count: Mapped[int] = mapped_column(Integer, default=0)

    document = relationship("Document", back_populates="chunks")
