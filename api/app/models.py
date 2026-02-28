from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AuthUser(StrictModel):
    id: str
    email: str | None = None


class AuthSession(StrictModel):
    access_token: str
    refresh_token: str
    expires_at: int
    token_type: str = "bearer"
    user: AuthUser


class AuthResponse(StrictModel):
    session: AuthSession | None
    confirmation_required: bool = False


class SignInRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class SignUpRequest(SignInRequest):
    display_name: str = Field(min_length=2, max_length=80)


class RefreshRequest(StrictModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


class PasswordRecoveryRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class MessageResponse(StrictModel):
    message: str


class Profile(StrictModel):
    id: str
    display_name: str
    username: str


class FriendRequest(StrictModel):
    username: str = Field(pattern=r"^@?[a-z0-9_]{3,40}$")

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.removeprefix("@").lower()


class Friendship(StrictModel):
    id: str
    status: Literal["pending", "accepted"]
    direction: Literal["incoming", "outgoing"]
    profile: Profile
    created_at: datetime
    responded_at: datetime | None = None


class CurrentUserResponse(StrictModel):
    user: AuthUser
    profile: Profile


class GoalInput(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=5000)
    completed: bool = False


class PhotoInput(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    width: int | None = Field(default=None, gt=0, le=30000)
    height: int | None = Field(default=None, gt=0, le=30000)


class CreateCapsuleRequest(StrictModel):
    title: str = Field(min_length=3, max_length=60)
    subtitle: str = Field(default="", max_length=200)
    capsule_type: Literal["letter", "goals", "memories", "predictions"]
    recipient: str = Field(min_length=1, max_length=80)
    letter: str = Field(default="", max_length=50000)
    goals: list[GoalInput] = Field(default_factory=list, max_length=50)
    predictions: list[Annotated[str, Field(min_length=1, max_length=5000)]] = Field(
        default_factory=list, max_length=50
    )
    photos: list[PhotoInput] = Field(default_factory=list, max_length=8)
    open_at: datetime
    accent: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    emoji: str = Field(min_length=1, max_length=16)
    reminder_enabled: bool = True
    shared_with_usernames: list[str] = Field(default_factory=list, max_length=20)
    collaborative: bool = False

    @field_validator("open_at")
    @classmethod
    def normalize_open_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Unlock time must include a timezone.")
        return value.astimezone(UTC)

    @field_validator("shared_with_usernames")
    @classmethod
    def normalize_usernames(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            handle = value.removeprefix("@").lower()
            if not re.fullmatch(r"[a-z0-9_]{3,40}", handle):
                raise ValueError(f"Invalid friend handle: @{handle}")
            if handle not in normalized:
                normalized.append(handle)
        return normalized

    @model_validator(mode="after")
    def require_content(self) -> CreateCapsuleRequest:
        if not self.letter and not self.goals and not self.predictions and not self.photos:
            raise ValueError("A capsule needs at least one item.")
        return self

    @model_validator(mode="after")
    def collaborative_capsules_need_friends(self) -> CreateCapsuleRequest:
        if self.collaborative and not self.shared_with_usernames:
            raise ValueError("A collaborative capsule needs at least one friend.")
        return self


class ContributionRequest(StrictModel):
    body: str = Field(min_length=1, max_length=5000)


class InviteMemberRequest(StrictModel):
    username: str = Field(pattern=r"^@?[a-z0-9_]{3,40}$")

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.removeprefix("@").lower()
