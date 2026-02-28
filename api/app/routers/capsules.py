from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import ValidationError

from ..config import Settings, get_settings
from ..dependencies import Identity, authenticated_identity, get_gateway
from ..models import ContributionRequest, CreateCapsuleRequest, InviteMemberRequest
from ..services.capsules import (
    ALLOWED_PHOTO_TYPES,
    CapsuleService,
    PhotoUpload,
    public_error,
)
from ..supabase_gateway import SupabaseError, SupabaseGateway

router = APIRouter(prefix="/v1/capsules", tags=["capsules"])


@router.get("")
async def list_capsules(
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, list[dict[str, Any]]]:
    service = CapsuleService(gateway)
    return {"data": await service.list(identity.token, str(identity.user["id"]))}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_capsule(
    payload: Annotated[str, Form()],
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
    settings: Annotated[Settings, Depends(get_settings)],
    photos: Annotated[list[UploadFile] | None, File()] = None,
) -> dict[str, dict[str, Any]]:
    try:
        request = CreateCapsuleRequest.model_validate_json(payload)
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error.errors(include_url=False),
        ) from error

    uploads: list[PhotoUpload] = []
    for index, photo in enumerate(photos or []):
        content_type = (photo.content_type or "").lower()
        if content_type not in ALLOWED_PHOTO_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Photos must be JPEG, PNG, WebP, HEIC, or HEIF.",
            )
        content = await photo.read(settings.max_photo_bytes + 1)
        await photo.close()
        if len(content) > settings.max_photo_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Each photo must be 10 MB or smaller.",
            )
        metadata = request.photos[index] if index < len(request.photos) else None
        uploads.append(
            PhotoUpload(
                content=content,
                content_type=content_type,
                width=metadata.width if metadata else None,
                height=metadata.height if metadata else None,
            )
        )

    service = CapsuleService(gateway)
    created = await service.create(identity.token, str(identity.user["id"]), request, uploads)
    return {"data": created}


@router.post("/{capsule_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    capsule_id: UUID,
    request: InviteMemberRequest,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, Any]:
    try:
        data = await gateway.invite_member(identity.token, str(capsule_id), request.username)
    except SupabaseError as error:
        raise public_error(error) from error
    return {"data": data}


@router.get("/{capsule_id}/members")
async def list_members(
    capsule_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, Any]:
    try:
        data = await gateway.list_members(identity.token, str(capsule_id))
    except SupabaseError as error:
        raise public_error(error) from error
    return {"data": data}


@router.post("/{capsule_id}/seal")
async def seal_capsule(
    capsule_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, Any]:
    service = CapsuleService(gateway)
    data = await service.seal(identity.token, str(identity.user["id"]), str(capsule_id))
    return {"data": data}


@router.get("/{capsule_id}/draft")
async def get_collaborative_draft(
    capsule_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, Any]:
    service = CapsuleService(gateway)
    data = await service.draft(identity.token, str(identity.user["id"]), str(capsule_id))
    return {"data": data}


@router.post("/{capsule_id}/contributions", status_code=status.HTTP_201_CREATED)
async def add_collaborative_contribution(
    capsule_id: UUID,
    request: ContributionRequest,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, Any]:
    service = CapsuleService(gateway)
    data = await service.contribute(
        identity.token,
        str(identity.user["id"]),
        str(capsule_id),
        request.body,
    )
    return {"data": data}


@router.post("/{capsule_id}/reveal")
async def reveal_capsule(
    capsule_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict[str, Any]:
    service = CapsuleService(gateway)
    data = await service.reveal(identity.token, str(identity.user["id"]), str(capsule_id))
    return {"data": data, "authority": "database"}


@router.get("/{capsule_id}/media/{item_id}")
async def capsule_media(
    capsule_id: UUID,
    item_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> Response:
    try:
        path = await gateway.get_photo_path(identity.token, str(capsule_id), str(item_id))
        content, content_type = await gateway.download_media(identity.token, path)
    except SupabaseError as error:
        raise public_error(error) from error
    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/{capsule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    capsule_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> Response:
    try:
        await gateway.delete_draft(identity.token, str(capsule_id))
    except SupabaseError as error:
        raise public_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
