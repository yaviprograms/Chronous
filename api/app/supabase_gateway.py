from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from .config import Settings


class SupabaseError(Exception):
    """A sanitized error returned by a Supabase HTTP API."""

    def __init__(self, status_code: int, message: str, code: str | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code


class SupabaseGateway:
    """The only application component allowed to communicate with Supabase."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _base_headers(self, bearer_token: str | None = None) -> dict[str, str]:
        if not self.settings.supabase_url or not self.settings.supabase_publishable_key:
            raise SupabaseError(503, "Supabase is not configured for this environment.")
        headers = {"apikey": self.settings.supabase_publishable_key}
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"
        return headers

    @staticmethod
    def _error_from_response(response: httpx.Response) -> SupabaseError:
        message = "The upstream data service rejected the request."
        code: str | None = None
        try:
            payload = response.json()
            if isinstance(payload, dict):
                code_value = payload.get("code") or payload.get("error_code")
                code = str(code_value) if code_value else None
                for key in ("msg", "message", "error_description", "error"):
                    value = payload.get(key)
                    if isinstance(value, str) and value.strip():
                        message = value.strip()
                        break
        except ValueError:
            pass
        return SupabaseError(response.status_code, message, code)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        bearer_token: str | None = None,
        params: dict[str, str] | None = None,
        json: Any = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        request_headers = self._base_headers(bearer_token)
        if headers:
            request_headers.update(headers)
        base_url = self.settings.supabase_url.rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=self.settings.upstream_timeout_seconds) as client:
                response = await client.request(
                    method,
                    f"{base_url}{path}",
                    params=params,
                    json=json,
                    content=content,
                    headers=request_headers,
                )
        except httpx.TimeoutException as exc:
            raise SupabaseError(504, "The upstream data service timed out.") from exc
        except httpx.HTTPError as exc:
            raise SupabaseError(502, "The upstream data service is unavailable.") from exc
        if response.is_error:
            raise self._error_from_response(response)
        return response

    async def _json_request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = await self._request(method, path, **kwargs)
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    async def sign_up(self, display_name: str, email: str, password: str) -> dict[str, Any]:
        return await self._json_request(
            "POST",
            "/auth/v1/signup",
            json={"email": email, "password": password, "data": {"full_name": display_name}},
            headers={"Content-Type": "application/json"},
        )

    async def sign_in(self, email: str, password: str) -> dict[str, Any]:
        return await self._json_request(
            "POST",
            "/auth/v1/token",
            params={"grant_type": "password"},
            json={"email": email, "password": password},
            headers={"Content-Type": "application/json"},
        )

    async def refresh_session(self, refresh_token: str) -> dict[str, Any]:
        return await self._json_request(
            "POST",
            "/auth/v1/token",
            params={"grant_type": "refresh_token"},
            json={"refresh_token": refresh_token},
            headers={"Content-Type": "application/json"},
        )

    async def request_password_recovery(self, email: str) -> None:
        params = (
            {"redirect_to": self.settings.password_reset_redirect_url}
            if self.settings.password_reset_redirect_url
            else None
        )
        await self._request(
            "POST",
            "/auth/v1/recover",
            params=params,
            json={"email": email},
            headers={"Content-Type": "application/json"},
        )

    async def sign_out(self, bearer_token: str) -> None:
        await self._request("POST", "/auth/v1/logout", bearer_token=bearer_token)

    async def get_user(self, bearer_token: str) -> dict[str, Any]:
        return await self._json_request("GET", "/auth/v1/user", bearer_token=bearer_token)

    async def get_profile(self, bearer_token: str, user_id: str) -> dict[str, Any]:
        rows = await self._json_request(
            "GET",
            "/rest/v1/profiles",
            bearer_token=bearer_token,
            params={
                "select": "id,display_name,username",
                "id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        if not rows:
            raise SupabaseError(404, "Profile not found.")
        return rows[0]

    async def search_profiles(self, bearer_token: str, query: str) -> list[dict[str, Any]]:
        rows = await self._json_request(
            "GET",
            "/rest/v1/profiles",
            bearer_token=bearer_token,
            params={
                "select": "id,display_name,username",
                "username": f"ilike.{query}%",
                "order": "username.asc",
                "limit": "10",
            },
        )
        return rows or []

    async def list_friendships(self, bearer_token: str, user_id: str) -> list[dict[str, Any]]:
        relationships = await self._json_request(
            "GET",
            "/rest/v1/friendships",
            bearer_token=bearer_token,
            params={
                "select": "id,requester_id,addressee_id,status,created_at,responded_at",
                "order": "created_at.desc",
            },
        )
        if not relationships:
            return []
        other_ids = [
            str(row["addressee_id"])
            if str(row["requester_id"]) == user_id
            else str(row["requester_id"])
            for row in relationships
        ]
        profiles = await self._json_request(
            "GET",
            "/rest/v1/profiles",
            bearer_token=bearer_token,
            params={
                "select": "id,display_name,username",
                "id": f"in.({','.join(other_ids)})",
            },
        )
        by_id = {str(profile["id"]): profile for profile in (profiles or [])}
        result = []
        for row in relationships:
            outgoing = str(row["requester_id"]) == user_id
            other_id = str(row["addressee_id"] if outgoing else row["requester_id"])
            profile = by_id.get(other_id)
            if profile:
                result.append(
                    {
                        "id": str(row["id"]),
                        "status": row["status"],
                        "direction": "outgoing" if outgoing else "incoming",
                        "profile": profile,
                        "created_at": row["created_at"],
                        "responded_at": row.get("responded_at"),
                    }
                )
        return result

    async def send_friend_request(self, bearer_token: str, username: str) -> dict[str, Any]:
        return await self._json_request(
            "POST",
            "/rest/v1/rpc/send_friend_request",
            bearer_token=bearer_token,
            json={"p_username": username},
            headers={"Content-Type": "application/json"},
        )

    async def respond_friend_request(
        self, bearer_token: str, friendship_id: str, accept: bool
    ) -> None:
        await self._json_request(
            "POST",
            "/rest/v1/rpc/respond_friend_request",
            bearer_token=bearer_token,
            json={"p_friendship_id": friendship_id, "p_accept": accept},
            headers={"Content-Type": "application/json"},
        )

    async def remove_friendship(self, bearer_token: str, friendship_id: str) -> None:
        await self._json_request(
            "POST",
            "/rest/v1/rpc/remove_friendship",
            bearer_token=bearer_token,
            json={"p_friendship_id": friendship_id},
            headers={"Content-Type": "application/json"},
        )

    async def list_capsules(self, bearer_token: str) -> list[dict[str, Any]]:
        rows = await self._json_request(
            "GET",
            "/rest/v1/capsules",
            bearer_token=bearer_token,
            params={
                "select": (
                    "id,user_id,title,subtitle,capsule_type,recipient,open_at,status,"
                    "accent,emoji,reminder_enabled,item_counts,seal_hash,sealed_at,"
                    "opened_at,created_at,collaborative"
                ),
                "order": "open_at.asc",
            },
        )
        return rows or []

    async def get_capsule(self, bearer_token: str, capsule_id: str) -> dict[str, Any]:
        rows = await self._json_request(
            "GET",
            "/rest/v1/capsules",
            bearer_token=bearer_token,
            params={
                "select": (
                    "id,user_id,title,subtitle,capsule_type,recipient,open_at,status,"
                    "accent,emoji,reminder_enabled,item_counts,seal_hash,sealed_at,"
                    "opened_at,created_at,collaborative"
                ),
                "id": f"eq.{capsule_id}",
                "limit": "1",
            },
        )
        if not rows:
            raise SupabaseError(404, "Capsule not found.")
        return rows[0]

    async def list_draft_items(
        self, bearer_token: str, capsule_id: str
    ) -> list[dict[str, Any]]:
        rows = await self._json_request(
            "GET",
            "/rest/v1/capsule_items",
            bearer_token=bearer_token,
            params={
                "select": "id,item_type,position,body,storage_path,metadata,contributor_id",
                "capsule_id": f"eq.{capsule_id}",
                "order": "position.asc,created_at.asc",
            },
        )
        return rows or []

    async def get_profiles_by_id(
        self, bearer_token: str, user_ids: list[str]
    ) -> list[dict[str, Any]]:
        if not user_ids:
            return []
        rows = await self._json_request(
            "GET",
            "/rest/v1/profiles",
            bearer_token=bearer_token,
            params={
                "select": "id,display_name,username",
                "id": f"in.({','.join(user_ids)})",
            },
        )
        return rows or []

    async def add_contribution(
        self, bearer_token: str, capsule_id: str, body: str
    ) -> dict[str, Any]:
        row = await self._json_request(
            "POST",
            "/rest/v1/rpc/add_capsule_contribution",
            bearer_token=bearer_token,
            json={"p_capsule_id": capsule_id, "p_body": body},
            headers={"Content-Type": "application/json"},
        )
        if not isinstance(row, dict):
            raise SupabaseError(502, "The contribution was not saved.")
        return row

    async def create_draft(
        self, bearer_token: str, user_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        rows = await self._json_request(
            "POST",
            "/rest/v1/capsules",
            bearer_token=bearer_token,
            json={**payload, "user_id": user_id, "status": "draft"},
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
        )
        if not rows:
            raise SupabaseError(502, "The capsule draft was not created.")
        return rows[0]

    async def insert_items(self, bearer_token: str, items: list[dict[str, Any]]) -> None:
        if not items:
            return
        await self._json_request(
            "POST",
            "/rest/v1/capsule_items",
            bearer_token=bearer_token,
            json=items,
            headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
        )

    async def invite_member(
        self, bearer_token: str, capsule_id: str, username: str
    ) -> dict[str, Any]:
        return await self._json_request(
            "POST",
            "/rest/v1/rpc/invite_capsule_member",
            bearer_token=bearer_token,
            json={"p_capsule_id": capsule_id, "p_username": username},
            headers={"Content-Type": "application/json"},
        )

    async def seal_capsule(self, bearer_token: str, capsule_id: str) -> dict[str, Any]:
        payload = await self._json_request(
            "POST",
            "/rest/v1/rpc/seal_capsule",
            bearer_token=bearer_token,
            json={"p_capsule_id": capsule_id},
            headers={"Content-Type": "application/json"},
        )
        if isinstance(payload, list):
            if not payload:
                raise SupabaseError(404, "Capsule not found.")
            return payload[0]
        if not isinstance(payload, dict):
            raise SupabaseError(502, "The capsule was not sealed.")
        return payload

    async def reveal_capsule(self, bearer_token: str, capsule_id: str) -> dict[str, Any]:
        payload = await self._json_request(
            "POST",
            "/rest/v1/rpc/reveal_capsule",
            bearer_token=bearer_token,
            json={"p_capsule_id": capsule_id},
            headers={"Content-Type": "application/json"},
        )
        if not isinstance(payload, dict):
            raise SupabaseError(404, "Capsule not found.")
        return payload

    async def delete_draft(self, bearer_token: str, capsule_id: str) -> None:
        await self._json_request(
            "DELETE",
            "/rest/v1/capsules",
            bearer_token=bearer_token,
            params={"id": f"eq.{capsule_id}", "status": "eq.draft"},
            headers={"Prefer": "return=minimal"},
        )

    async def upload_media(
        self,
        bearer_token: str,
        storage_path: str,
        content: bytes,
        content_type: str,
    ) -> None:
        encoded_path = quote(f"capsule-media/{storage_path}", safe="/")
        await self._request(
            "POST",
            f"/storage/v1/object/{encoded_path}",
            bearer_token=bearer_token,
            content=content,
            headers={
                "Content-Type": content_type,
                "cache-control": "max-age=3600",
                "x-upsert": "false",
            },
        )

    async def remove_media(self, bearer_token: str, storage_paths: list[str]) -> None:
        if not storage_paths:
            return
        await self._request(
            "DELETE",
            "/storage/v1/object/capsule-media",
            bearer_token=bearer_token,
            json={"prefixes": storage_paths},
            headers={"Content-Type": "application/json"},
        )

    async def get_photo_path(self, bearer_token: str, capsule_id: str, item_id: str) -> str:
        rows = await self._json_request(
            "GET",
            "/rest/v1/capsule_items",
            bearer_token=bearer_token,
            params={
                "select": "storage_path",
                "id": f"eq.{item_id}",
                "capsule_id": f"eq.{capsule_id}",
                "item_type": "eq.photo",
                "limit": "1",
            },
        )
        if not rows or not rows[0].get("storage_path"):
            raise SupabaseError(404, "Photo not found.")
        return str(rows[0]["storage_path"])

    async def download_media(self, bearer_token: str, storage_path: str) -> tuple[bytes, str]:
        encoded_path = quote(f"capsule-media/{storage_path}", safe="/")
        response = await self._request(
            "GET", f"/storage/v1/object/{encoded_path}", bearer_token=bearer_token
        )
        content_type = response.headers.get("content-type", "application/octet-stream")
        return response.content, content_type

    async def list_members(self, bearer_token: str, capsule_id: str) -> list[dict[str, Any]]:
        memberships = await self._json_request(
            "GET",
            "/rest/v1/capsule_members",
            bearer_token=bearer_token,
            params={
                "select": "user_id,role,created_at",
                "capsule_id": f"eq.{capsule_id}",
                "order": "created_at.asc",
            },
        )
        if not memberships:
            return []
        ids = [str(row["user_id"]) for row in memberships]
        profiles = await self._json_request(
            "GET",
            "/rest/v1/profiles",
            bearer_token=bearer_token,
            params={"select": "id,display_name,username", "id": f"in.({','.join(ids)})"},
        )
        by_id = {str(profile["id"]): profile for profile in (profiles or [])}
        return [
            {**membership, "profile": by_id.get(str(membership["user_id"]))}
            for membership in memberships
        ]
