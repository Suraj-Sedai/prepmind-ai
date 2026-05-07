from pathlib import Path
from secrets import token_urlsafe
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse
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
GOOGLE_SCOPES = "openid email profile"


def persist_session(request: Request, user: User) -> None:
    request.session.clear()
    request.session["user_id"] = user.id


def google_oauth_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def google_redirect_uri(request: Request) -> str:
    if settings.google_redirect_uri:
        return settings.google_redirect_uri
    return str(request.url_for("google_callback"))


def frontend_redirect(params: dict[str, str] | None = None) -> RedirectResponse:
    base_url = settings.frontend_origin.rstrip("/")
    if not params:
        return RedirectResponse(f"{base_url}/", status_code=status.HTTP_302_FOUND)
    return RedirectResponse(f"{base_url}/?{urlencode(params)}", status_code=status.HTTP_302_FOUND)


def provider_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = response.text
    return f"{response.status_code} {response.reason_phrase}: {payload}"


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


@router.get("/google/start")
def google_start(request: Request) -> RedirectResponse:
    if not google_oauth_configured():
        raise HTTPException(status_code=503, detail="Google login is not configured.")

    state = token_urlsafe(32)
    request.session["google_oauth_state"] = state
    params = {
        "client_id": settings.google_client_id or "",
        "redirect_uri": google_redirect_uri(request),
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "state": state,
        "include_granted_scopes": "true",
    }
    return RedirectResponse(
        f"{settings.google_oauth_authorize_url}?{urlencode(params)}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/google/callback", name="google_callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error:
        return frontend_redirect({"auth_error": error})
    if not google_oauth_configured():
        return frontend_redirect({"auth_error": "Google login is not configured."})
    expected_state = request.session.pop("google_oauth_state", None)
    if not code or not state or not expected_state or state != expected_state:
        return frontend_redirect({"auth_error": "Invalid Google login state. Please try again."})

    try:
        token_response = httpx.post(
            settings.google_oauth_token_url,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": google_redirect_uri(request),
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=20.0,
        )
        if token_response.is_error:
            return frontend_redirect({"auth_error": provider_error(token_response)})
        access_token = token_response.json().get("access_token")
        if not access_token:
            return frontend_redirect({"auth_error": "Google did not return an access token."})

        userinfo_response = httpx.get(
            settings.google_oauth_userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20.0,
        )
        if userinfo_response.is_error:
            return frontend_redirect({"auth_error": provider_error(userinfo_response)})
        userinfo = userinfo_response.json()
    except httpx.RequestError:
        return frontend_redirect({"auth_error": "Could not reach Google login. Please try again."})

    google_sub = str(userinfo.get("sub") or "")
    email = str(userinfo.get("email") or "").strip().lower()
    email_verified = userinfo.get("email_verified")
    if not google_sub or not email:
        return frontend_redirect({"auth_error": "Google account did not provide an email address."})
    if email_verified not in {True, "true", "True", "1", 1}:
        return frontend_redirect({"auth_error": "Google email must be verified before signing in."})

    user = db.scalar(select(User).where(User.google_sub == google_sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None:
            if user.google_sub and user.google_sub != google_sub:
                return frontend_redirect({"auth_error": "This email is already linked to another Google account."})
            user.google_sub = google_sub
            user.auth_provider = "google"
        else:
            display_name = str(userinfo.get("name") or email.split("@", maxsplit=1)[0]).strip()[:120]
            user = User(
                name=display_name or "PrepMind Student",
                email=email,
                password_hash=hash_password(token_urlsafe(32)),
                auth_provider="google",
                google_sub=google_sub,
            )
            db.add(user)

    db.commit()
    db.refresh(user)
    persist_session(request, user)
    return frontend_redirect({"auth": "google"})


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
