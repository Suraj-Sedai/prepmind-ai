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
            statements.append("ALTER TABLE document_chunks ADD COLUMN embedding_model VARCHAR(120) NOT NULL DEFAULT 'local-hash-v1'")
        if "embedding_norm" not in chunk_columns:
            statements.append("ALTER TABLE document_chunks ADD COLUMN embedding_norm VARCHAR(32)")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
