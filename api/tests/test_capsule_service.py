from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.models import CreateCapsuleRequest
from app.services.capsules import CapsuleService, capsule_item


def test_mixed_capsule_items_have_identical_bulk_insert_keys() -> None:
    rows = [
        capsule_item("capsule-id", "letter", 0, body="Hello, future."),
        capsule_item(
            "capsule-id",
            "goal",
            1,
            body="Ship Chronous",
            metadata={"completed": False},
        ),
        capsule_item(
            "capsule-id",
            "photo",
            2,
            storage_path="user/capsule/photo.jpg",
            metadata={"width": 1200, "height": 800},
        ),
    ]

    expected_keys = {
        "capsule_id",
        "item_type",
        "position",
        "body",
        "storage_path",
        "metadata",
    }
    assert all(set(row) == expected_keys for row in rows)
    assert rows[0]["storage_path"] is None
    assert rows[2]["body"] is None


@pytest.mark.asyncio
async def test_collaborative_capsule_stays_draft_until_owner_seals() -> None:
    owner_id = str(uuid4())
    capsule_id = str(uuid4())
    created_at = datetime.now(UTC).isoformat()
    gateway = AsyncMock()
    gateway.create_draft.return_value = {
        "id": capsule_id,
        "user_id": owner_id,
        "title": "Our senior year",
        "subtitle": "One shared memory",
        "capsule_type": "letter",
        "recipient": "Future us",
        "open_at": (datetime.now(UTC) + timedelta(days=365)).isoformat(),
        "status": "draft",
        "accent": "#9D8CFF",
        "emoji": "✦",
        "reminder_enabled": True,
        "collaborative": True,
        "created_at": created_at,
    }
    payload = CreateCapsuleRequest(
        title="Our senior year",
        subtitle="One shared memory",
        capsule_type="letter",
        recipient="Future us",
        letter="Here is where our story starts.",
        open_at=datetime.now(UTC) + timedelta(days=365),
        accent="#9D8CFF",
        emoji="✦",
        shared_with_usernames=["maya_friend"],
        collaborative=True,
    )

    result = await CapsuleService(gateway).create("user-jwt", owner_id, payload, [])

    assert result["status"] == "draft"
    assert result["is_owner"] is True
    assert result["item_counts"]["letter"] == 1
    gateway.invite_member.assert_awaited_once_with("user-jwt", capsule_id, "maya_friend")
    gateway.insert_items.assert_awaited_once()
    gateway.seal_capsule.assert_not_awaited()
