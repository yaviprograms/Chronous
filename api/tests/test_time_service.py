from datetime import UTC, datetime, timedelta

from app.time_service import compute_countdown


def test_countdown_uses_positive_remaining_seconds() -> None:
    now = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)
    countdown = compute_countdown(now + timedelta(days=2, seconds=42), now)

    assert countdown.remaining_seconds == 172_842
    assert countdown.is_unlocked is False


def test_past_capsule_is_unlocked_and_never_negative() -> None:
    now = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)
    countdown = compute_countdown(now - timedelta(seconds=1), now)

    assert countdown.remaining_seconds == 0
    assert countdown.is_unlocked is True


def test_naive_dates_are_treated_as_utc() -> None:
    now = datetime(2026, 7, 31, 12, 0)
    countdown = compute_countdown(datetime(2026, 7, 31, 13, 0), now)

    assert countdown.server_time.tzinfo == UTC
    assert countdown.remaining_seconds == 3600
