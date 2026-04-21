from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, SessionState, UserCreate, UserLogin, UserRead
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def persist_session(request: Request, user: User) -> None:
    request.session.clear()
    request.session["user_id"] = user.id


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
