from datetime import UTC, datetime
from typing import Annotated

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import get_settings
from .routers import auth, capsules, profiles
from .time_service import compute_countdown


class TimeResponse(BaseModel):
    server_time: datetime
    unlock_at: datetime | None = None
    remaining_seconds: int | None = None
    is_unlocked: bool | None = None


settings = get_settings()
app = FastAPI(
    title="Chronous API",
    version="2.0.0",
    description="Backend-for-frontend for Chronous authentication, capsules, friends, and media.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth.router)
app.include_router(capsules.router)
app.include_router(profiles.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy", "service": "chronous-api"}


@app.get("/v1/time", response_model=TimeResponse)
async def trusted_time(
    unlock_at: Annotated[datetime | None, Query()] = None,
) -> TimeResponse:
    now = datetime.now(UTC)
    if unlock_at is None:
        return TimeResponse(server_time=now)
    countdown = compute_countdown(unlock_at, now)
    return TimeResponse(
        server_time=countdown.server_time,
        unlock_at=countdown.unlock_at,
        remaining_seconds=countdown.remaining_seconds,
        is_unlocked=countdown.is_unlocked,
    )
