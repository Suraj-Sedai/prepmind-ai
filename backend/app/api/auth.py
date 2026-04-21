from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, SessionState, UserCreate, UserLogin, UserProfileUpdate, UserRead
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
ALLOWED_PROFILE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024


def persist_session(request: Request, user: User) -> None:
    request.session.clear()
    request.session["user_id"] = user.id


def remove_existing_profile_image(relative_path: str | None) -> None:
    if not relative_path:
        return
    target = settings.upload_path / relative_path
    if target.exists():
        target.unlink()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    user = User(
        name=payload.name,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    persist_session(request, user)
    return AuthResponse(message="User registered successfully.", user=user)


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    persist_session(request, user)
    return AuthResponse(message="Login successful.", user=user)


@router.post("/logout")
def logout(request: Request) -> dict[str, str]:
    request.session.clear()
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=SessionState)
def me(current_user: User = Depends(get_current_user)) -> SessionState:
    return SessionState(authenticated=True, user=UserRead.model_validate(current_user))


@router.get("/session", response_model=SessionState)
def session_state(
    request: Request,
    db: Session = Depends(get_db),
) -> SessionState:
    user_id = request.session.get("user_id")
    if user_id is None:
        return SessionState(authenticated=False, user=None)

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        request.session.clear()
        return SessionState(authenticated=False, user=None)

    return SessionState(authenticated=True, user=UserRead.model_validate(user))


@router.patch("/profile", response_model=AuthResponse)
def update_profile(
    payload: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthResponse:
    normalized_name = payload.name.strip()
    if len(normalized_name) < 2:
        raise HTTPException(status_code=400, detail="Display name must be at least 2 characters.")
    current_user.name = normalized_name
    current_user.preferred_difficulty = payload.preferred_difficulty
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    persist_session(request, current_user)
    return AuthResponse(message="Profile updated.", user=current_user)


@router.post("/profile-image", response_model=AuthResponse)
async def upload_profile_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthResponse:
    suffix = ALLOWED_PROFILE_TYPES.get(file.content_type or "")
    if suffix is None:
        raise HTTPException(status_code=400, detail="Use JPG, PNG, or WEBP for profile images.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Profile image is empty.")
    if len(payload) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Profile image must be 5 MB or smaller.")

    profile_dir = settings.upload_path / "profiles"
    profile_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user-{current_user.id}-{uuid4().hex[:8]}{suffix}"
    relative_path = Path("profiles") / filename
    destination = settings.upload_path / relative_path
    destination.write_bytes(payload)

    remove_existing_profile_image(current_user.profile_image_path)
    current_user.profile_image_path = relative_path.as_posix()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    persist_session(request, current_user)
    return AuthResponse(message="Profile image updated.", user=current_user)
