from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PrepMind AI"
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
    openai_base_url: str = "https://api.openai.com/v1"
    openai_chat_model: str = "gpt-5"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_api_key: str | None = None

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
