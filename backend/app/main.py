from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.api.auth import router as auth_router
from app.api.deps import ensure_storage_dirs
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.study import router as study_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.bootstrap import ensure_runtime_schema
from app.db.session import engine
from app.models import document, study, user  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_storage_dirs()
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema(engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie=settings.session_cookie_name,
    max_age=settings.session_max_age,
    same_site="lax",
    https_only=settings.session_https_only,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(study_router, prefix="/api")
app.mount("/media", StaticFiles(directory=settings.upload_path), name="media")

frontend_dist = settings.frontend_dist_path
frontend_assets = frontend_dist / "assets"

if frontend_assets.exists():
    app.mount("/assets", StaticFiles(directory=frontend_assets), name="frontend-assets")


def _frontend_file(path_value: str) -> Path | None:
    candidate = frontend_dist / path_value
    if candidate.exists() and candidate.is_file():
        return candidate
    return None


if frontend_dist.exists():
    @app.get("/", include_in_schema=False)
    async def frontend_index() -> FileResponse:
        return FileResponse(frontend_dist / "index.html")


    @app.get("/{full_path:path}", include_in_schema=False)
    async def frontend_routes(full_path: str) -> FileResponse:
        static_file = _frontend_file(full_path)
        if static_file is not None:
            return FileResponse(static_file)
        return FileResponse(frontend_dist / "index.html")
