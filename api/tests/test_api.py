from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.capsules import CapsuleService
from app.supabase_gateway import SupabaseGateway


@pytest.fixture
def transport() -> ASGITransport:
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_health_endpoint(transport: ASGITransport) -> None:
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "chronous-api"}


@pytest.mark.asyncio
async def test_trusted_time_endpoint_returns_countdown(transport: ASGITransport) -> None:
    unlock_at = datetime.now(UTC) + timedelta(minutes=5)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/time", params={"unlock_at": unlock_at.isoformat()})

    assert response.status_code == 200
    body = response.json()
    assert body["is_unlocked"] is False
    assert 295 <= body["remaining_seconds"] <= 300


@pytest.mark.asyncio
async def test_reveal_requires_a_bearer_token(transport: ASGITransport) -> None:
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(f"/v1/capsules/{uuid4()}/reveal")

    assert response.status_code == 401
    assert response.json()["detail"] == "An access token is required."


@pytest.mark.asyncio
async def test_reveal_forwards_authenticated_request(
    monkeypatch,
    transport: ASGITransport,
) -> None:
    capsule_id = uuid4()
    payload = {
        "capsule": {"id": str(capsule_id), "status": "opened"},
        "items": [{"item_type": "letter", "body": "Hello, future."}],
        "trusted_time": datetime.now(UTC).isoformat(),
    }

    async def fake_get_user(self: SupabaseGateway, bearer_token: str) -> dict:
        assert bearer_token == "user-jwt"
        return {"id": str(uuid4()), "email": "keeper@example.com"}

    async def fake_reveal(
        self: CapsuleService,
        bearer_token: str,
        user_id: str,
        requested_id: str,
    ) -> dict:
        assert bearer_token == "user-jwt"
        assert user_id
        assert requested_id == str(capsule_id)
        return payload

    monkeypatch.setattr(SupabaseGateway, "get_user", fake_get_user)
    monkeypatch.setattr(CapsuleService, "reveal", fake_reveal)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            f"/v1/capsules/{capsule_id}/reveal",
            headers={"Authorization": "Bearer user-jwt"},
        )

    assert response.status_code == 200
    assert response.json()["data"] == payload
    assert response.json()["authority"] == "database"


@pytest.mark.asyncio
async def test_password_recovery_has_privacy_safe_response(
    monkeypatch,
    transport: ASGITransport,
) -> None:
    async def fake_recovery(self: SupabaseGateway, email: str) -> None:
        assert email == "keeper@example.com"

    monkeypatch.setattr(SupabaseGateway, "request_password_recovery", fake_recovery)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/recover-password",
            json={"email": "KEEPER@example.com"},
        )

    assert response.status_code == 202
    assert response.json() == {
        "message": "If an account exists for that email, a password recovery link is on its way."
    }


@pytest.mark.asyncio
async def test_friend_list_requires_authentication(transport: ASGITransport) -> None:
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/friends")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_friend_list_returns_relationships(
    monkeypatch,
    transport: ASGITransport,
) -> None:
    user_id = str(uuid4())
    friend_id = str(uuid4())
    friendship_id = str(uuid4())

    async def fake_get_user(self: SupabaseGateway, bearer_token: str) -> dict:
        assert bearer_token == "user-jwt"
        return {"id": user_id, "email": "keeper@example.com"}

    async def fake_list(
        self: SupabaseGateway,
        bearer_token: str,
        requested_user_id: str,
    ) -> list[dict]:
        assert bearer_token == "user-jwt"
        assert requested_user_id == user_id
        return [
            {
                "id": friendship_id,
                "status": "accepted",
                "direction": "outgoing",
                "profile": {
                    "id": friend_id,
                    "display_name": "Maya",
                    "username": "maya_friend",
                },
                "created_at": datetime.now(UTC).isoformat(),
                "responded_at": datetime.now(UTC).isoformat(),
            }
        ]

    monkeypatch.setattr(SupabaseGateway, "get_user", fake_get_user)
    monkeypatch.setattr(SupabaseGateway, "list_friendships", fake_list)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/v1/friends",
            headers={"Authorization": "Bearer user-jwt"},
        )

    assert response.status_code == 200
    assert response.json()[0]["profile"]["username"] == "maya_friend"


@pytest.mark.asyncio
async def test_contribution_forwards_authenticated_user(
    monkeypatch,
    transport: ASGITransport,
) -> None:
    user_id = str(uuid4())
    capsule_id = uuid4()

    async def fake_get_user(self: SupabaseGateway, bearer_token: str) -> dict:
        return {"id": user_id, "email": "keeper@example.com"}

    async def fake_contribute(
        self: CapsuleService,
        bearer_token: str,
        requested_user_id: str,
        requested_capsule_id: str,
        body: str,
    ) -> dict:
        assert bearer_token == "user-jwt"
        assert requested_user_id == user_id
        assert requested_capsule_id == str(capsule_id)
        assert body == "We did it together."
        return {"id": str(uuid4()), "body": body}

    monkeypatch.setattr(SupabaseGateway, "get_user", fake_get_user)
    monkeypatch.setattr(CapsuleService, "contribute", fake_contribute)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            f"/v1/capsules/{capsule_id}/contributions",
            headers={"Authorization": "Bearer user-jwt"},
            json={"body": "We did it together."},
        )

    assert response.status_code == 201
    assert response.json()["data"]["body"] == "We did it together."
