from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    preferred_difficulty: Literal["easy", "medium", "hard"]


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    preferred_difficulty: str
    profile_image_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    message: str
    user: UserRead


class SessionState(BaseModel):
    authenticated: bool
    user: UserRead | None = None
