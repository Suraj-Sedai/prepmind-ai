from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Prepmind.ai"
    env: str = "development"
    database_url: str = "sqlite:///./data/prepmind.db"
    upload_dir: str = "./uploads"
    demo_email: str = "demo@prepmind.local"
    demo_name: str = "PrepMind Demo"
    frontend_origin: str = "http://localhost:5173"
    session_secret: str = "prepmind-local-session-secret"
    session_cookie_name: str = "prepmind_session"
    session_max_age: int = 60 * 60 * 24 * 7
    session_https_only: bool = False
    max_upload_size_mb: int = 15
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_chat_model: str = Field(
        default="gemini-2.5-flash",
        validation_alias=AliasChoices("PREPMIND_GEMINI_CHAT_MODEL", "GEMINI_CHAT_MODEL"),
    )
    gemini_embedding_model: str = Field(
        default="gemini-embedding-001",
        validation_alias=AliasChoices("PREPMIND_GEMINI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_MODEL"),
    )
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("PREPMIND_GEMINI_API_KEY", "GEMINI_API_KEY"),
    )
    openai_base_url: str = "https://api.openai.com/v1"
    openai_chat_model: str = Field(
        default="gpt-5",
        validation_alias=AliasChoices("PREPMIND_OPENAI_CHAT_MODEL", "OPENAI_CHAT_MODEL"),
    )
    openai_embedding_model: str = Field(
        default="text-embedding-3-small",
        validation_alias=AliasChoices("PREPMIND_OPENAI_EMBEDDING_MODEL", "OPENAI_EMBEDDING_MODEL"),
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("PREPMIND_OPENAI_API_KEY", "OPENAI_API_KEY"),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PREPMIND_",
        extra="ignore",
    )

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir).resolve()

    @property
    def frontend_dist_path(self) -> Path:
        return Path(__file__).resolve().parents[3] / "frontend" / "dist"


@lru_cache
def get_settings() -> Settings:
    return Settings()
