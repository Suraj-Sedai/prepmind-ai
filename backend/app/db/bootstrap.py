from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_runtime_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "users" not in table_names:
        return

    statements: list[str] = []

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "profile_image_path" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(255)")
    if "auth_provider" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(32) NOT NULL DEFAULT 'password'")
    if "google_sub" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)")
        statements.append("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL")

    if "documents" not in table_names:
        if statements:
            with engine.begin() as connection:
                for statement in statements:
                    connection.execute(text(statement))
        return

    columns = {column["name"] for column in inspector.get_columns("documents")}

    if "file_size_bytes" not in columns:
        statements.append("ALTER TABLE documents ADD COLUMN file_size_bytes INTEGER NOT NULL DEFAULT 0")
    if "extracted_word_count" not in columns:
        statements.append("ALTER TABLE documents ADD COLUMN extracted_word_count INTEGER NOT NULL DEFAULT 0")
    if "topic_summary" not in columns:
        statements.append("ALTER TABLE documents ADD COLUMN topic_summary VARCHAR(255) NOT NULL DEFAULT ''")
    if "error_message" not in columns:
        statements.append("ALTER TABLE documents ADD COLUMN error_message TEXT")

    if "document_chunks" in table_names:
        chunk_columns = {column["name"] for column in inspector.get_columns("document_chunks")}
        if "embedding_vector" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN embedding_vector TEXT")
        if "embedding_model" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN embedding_model VARCHAR(120) NOT NULL DEFAULT ''")
        if "embedding_norm" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN embedding_norm VARCHAR(32)")
        if "page_start" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN page_start INTEGER")
        if "page_end" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN page_end INTEGER")
        if "section_heading" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN section_heading VARCHAR(180)")
        if "content_type" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN content_type VARCHAR(80) NOT NULL DEFAULT 'supporting_content'")
        if "importance_score" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN importance_score FLOAT NOT NULL DEFAULT 0.5")
        if "metadata_json" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN metadata_json TEXT")

    if "flashcards" in table_names:
        flashcard_columns = {column["name"] for column in inspector.get_columns("flashcards")}
        if "source_document_name" not in flashcard_columns:
            statements.append("ALTER TABLE flashcards ADD COLUMN source_document_name VARCHAR(255)")
        if "source_page_start" not in flashcard_columns:
            statements.append("ALTER TABLE flashcards ADD COLUMN source_page_start INTEGER")
        if "source_snippet" not in flashcard_columns:
            statements.append("ALTER TABLE flashcards ADD COLUMN source_snippet TEXT")

    if "chat_threads" in table_names:
        chat_thread_columns = {column["name"] for column in inspector.get_columns("chat_threads")}
        if "course_name" not in chat_thread_columns:
            statements.append("ALTER TABLE chat_threads ADD COLUMN course_name VARCHAR(120)")
        if "document_id" not in chat_thread_columns:
            statements.append("ALTER TABLE chat_threads ADD COLUMN document_id INTEGER")

    if "chat_messages" in table_names:
        chat_message_columns = {column["name"] for column in inspector.get_columns("chat_messages")}
        if "answer_status" not in chat_message_columns:
            statements.append("ALTER TABLE chat_messages ADD COLUMN answer_status VARCHAR(40)")
        if "confidence_label" not in chat_message_columns:
            statements.append("ALTER TABLE chat_messages ADD COLUMN confidence_label VARCHAR(20)")
        if "used_general_ai" not in chat_message_columns:
            statements.append("ALTER TABLE chat_messages ADD COLUMN used_general_ai BOOLEAN NOT NULL DEFAULT 0")
        if "citations_json" not in chat_message_columns:
            statements.append("ALTER TABLE chat_messages ADD COLUMN citations_json TEXT")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
