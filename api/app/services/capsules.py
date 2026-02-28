from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status

from ..models import CreateCapsuleRequest
from ..supabase_gateway import SupabaseError, SupabaseGateway

ALLOWED_PHOTO_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}


@dataclass(frozen=True)
class PhotoUpload:
    content: bytes
    content_type: str
    width: int | None
    height: int | None


def capsule_item(
    capsule_id: str,
    item_type: str,
    position: int,
    *,
    body: str | None = None,
    storage_path: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a uniform row for PostgREST bulk inserts."""
    return {
        "capsule_id": capsule_id,
        "item_type": item_type,
        "position": position,
        "body": body,
        "storage_path": storage_path,
        "metadata": metadata or {},
    }


def capsule_summary(row: dict[str, Any], user_id: str) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "subtitle": row.get("subtitle") or "",
        "capsule_type": row["capsule_type"],
        "recipient": row["recipient"],
        "open_at": row["open_at"],
        "status": row["status"],
        "accent": row["accent"],
        "emoji": row["emoji"],
        "reminder_enabled": row["reminder_enabled"],
        "item_counts": row.get("item_counts") or {},
        "integrity_hash": row.get("seal_hash"),
        "opened_at": row.get("opened_at"),
        "created_at": row["created_at"],
        "collaborative": bool(row.get("collaborative", False)),
        "is_shared": str(row["user_id"]) != user_id,
        "owner_id": str(row["user_id"]),
        "is_owner": str(row["user_id"]) == user_id,
    }


def public_error(error: SupabaseError) -> HTTPException:
    message = error.message
    lowered = message.lower()
    if error.status_code in {401, 403}:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    if error.status_code == 404:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    if "not ready" in lowered or "unlock" in lowered:
        return HTTPException(status_code=status.HTTP_423_LOCKED, detail=message)
    if error.status_code in {400, 409} or error.code in {"23505", "23514"}:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)


class CapsuleService:
    def __init__(self, gateway: SupabaseGateway) -> None:
        self.gateway = gateway

    async def list(self, token: str, user_id: str) -> list[dict[str, Any]]:
        try:
            rows = await self.gateway.list_capsules(token)
        except SupabaseError as error:
            raise public_error(error) from error
        return [capsule_summary(row, user_id) for row in rows]

    async def create(
        self,
        token: str,
        user_id: str,
        payload: CreateCapsuleRequest,
        photos: list[PhotoUpload],
    ) -> dict[str, Any]:
        if payload.open_at <= datetime.now(UTC) + timedelta(minutes=10):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Choose an unlock time at least 10 minutes in the future.",
            )
        if len(payload.photos) != len(photos):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photo metadata does not match the uploaded files.",
            )

        capsule_id: str | None = None
        uploaded_paths: list[str] = []
        try:
            draft = await self.gateway.create_draft(
                token,
                user_id,
                {
                    "title": payload.title,
                    "subtitle": payload.subtitle,
                    "capsule_type": payload.capsule_type,
                    "recipient": payload.recipient,
                    "open_at": payload.open_at.isoformat(),
                    "accent": payload.accent,
                    "emoji": payload.emoji,
                    "reminder_enabled": payload.reminder_enabled,
                    "collaborative": payload.collaborative,
                },
            )
            capsule_id = str(draft["id"])

            for username in payload.shared_with_usernames:
                await self.gateway.invite_member(token, capsule_id, username)

            items: list[dict[str, Any]] = []
            position = 0
            if payload.letter:
                items.append(
                    capsule_item(
                        capsule_id,
                        "letter",
                        position,
                        body=payload.letter,
                    )
                )
                position += 1
            for goal in payload.goals:
                items.append(
                    capsule_item(
                        capsule_id,
                        "goal",
                        position,
                        body=goal.text,
                        metadata={"completed": goal.completed},
                    )
                )
                position += 1
            for prediction in payload.predictions:
                items.append(
                    capsule_item(
                        capsule_id,
                        "prediction",
                        position,
                        body=prediction,
                    )
                )
                position += 1
            for metadata, upload in zip(payload.photos, photos, strict=True):
                extension = ALLOWED_PHOTO_TYPES[upload.content_type]
                path = f"{user_id}/{capsule_id}/{uuid4()}.{extension}"
                await self.gateway.upload_media(token, path, upload.content, upload.content_type)
                uploaded_paths.append(path)
                items.append(
                    capsule_item(
                        capsule_id,
                        "photo",
                        position,
                        storage_path=path,
                        metadata={
                            "client_id": metadata.id,
                            "width": upload.width,
                            "height": upload.height,
                        },
                    )
                )
                position += 1

            await self.gateway.insert_items(token, items)
            if payload.collaborative:
                draft["item_counts"] = {
                    "letter": 1 if payload.letter else 0,
                    "goals": len(payload.goals),
                    "predictions": len(payload.predictions),
                    "photos": len(payload.photos),
                }
                return capsule_summary(draft, user_id)
            sealed = await self.gateway.seal_capsule(token, capsule_id)
            return capsule_summary(sealed, user_id)
        except SupabaseError as error:
            if capsule_id:
                try:
                    await self.gateway.remove_media(token, uploaded_paths)
                except SupabaseError:
                    pass
                try:
                    await self.gateway.delete_draft(token, capsule_id)
                except SupabaseError:
                    pass
            raise public_error(error) from error

    async def draft(self, token: str, user_id: str, capsule_id: str) -> dict[str, Any]:
        try:
            capsule = await self.gateway.get_capsule(token, capsule_id)
            if capsule["status"] != "draft" or not capsule.get("collaborative", False):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This capsule is no longer accepting contributions.",
                )
            rows = await self.gateway.list_draft_items(token, capsule_id)
            contributor_ids = list({str(row["contributor_id"]) for row in rows})
            profiles = await self.gateway.get_profiles_by_id(token, contributor_ids)
        except SupabaseError as error:
            raise public_error(error) from error
        by_id = {str(profile["id"]): profile for profile in profiles}
        items = []
        for row in rows:
            item = {
                "id": str(row["id"]),
                "item_type": row["item_type"],
                "position": row["position"],
                "body": row.get("body"),
                "metadata": row.get("metadata") or {},
                "contributor": by_id.get(str(row["contributor_id"])),
            }
            if row["item_type"] == "photo":
                item["media_path"] = f"/v1/capsules/{capsule_id}/media/{row['id']}"
            items.append(item)
        return {"capsule": capsule_summary(capsule, user_id), "items": items}

    async def contribute(
        self, token: str, user_id: str, capsule_id: str, body: str
    ) -> dict[str, Any]:
        try:
            row = await self.gateway.add_contribution(token, capsule_id, body)
            profile = await self.gateway.get_profile(token, user_id)
        except SupabaseError as error:
            raise public_error(error) from error
        return {
            "id": str(row["id"]),
            "item_type": row["item_type"],
            "position": row["position"],
            "body": row.get("body"),
            "metadata": row.get("metadata") or {},
            "contributor": profile,
        }

    async def seal(self, token: str, user_id: str, capsule_id: str) -> dict[str, Any]:
        try:
            row = await self.gateway.seal_capsule(token, capsule_id)
        except SupabaseError as error:
            raise public_error(error) from error
        return capsule_summary(row, user_id)

    async def reveal(self, token: str, user_id: str, capsule_id: str) -> dict[str, Any]:
        try:
            payload = await self.gateway.reveal_capsule(token, capsule_id)
            contributor_ids = list(
                {
                    str(item["contributor_id"])
                    for item in (payload.get("items") or [])
                    if item.get("contributor_id")
                }
            )
            profiles = await self.gateway.get_profiles_by_id(token, contributor_ids)
        except SupabaseError as error:
            raise public_error(error) from error

        capsule = capsule_summary(payload["capsule"], user_id)
        profiles_by_id = {str(profile["id"]): profile for profile in profiles}
        items = []
        for item in payload.get("items") or []:
            public_item = {
                "id": str(item["id"]),
                "item_type": item["item_type"],
                "position": item["position"],
                "body": item.get("body"),
                "metadata": item.get("metadata") or {},
                "contributor": profiles_by_id.get(str(item.get("contributor_id"))),
            }
            if item["item_type"] == "photo":
                public_item["media_path"] = f"/v1/capsules/{capsule_id}/media/{item['id']}"
            items.append(public_item)
        return {
            "capsule": capsule,
            "items": items,
            "trusted_time": payload["trusted_time"],
        }
