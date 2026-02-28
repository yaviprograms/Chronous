from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class Countdown:
    server_time: datetime
    unlock_at: datetime
    remaining_seconds: int
    is_unlocked: bool


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def compute_countdown(unlock_at: datetime, now: datetime | None = None) -> Countdown:
    server_time = ensure_utc(now or datetime.now(UTC))
    normalized_unlock = ensure_utc(unlock_at)
    remaining = max(0, int((normalized_unlock - server_time).total_seconds()))
    return Countdown(
        server_time=server_time,
        unlock_at=normalized_unlock,
        remaining_seconds=remaining,
        is_unlocked=remaining == 0,
    )
