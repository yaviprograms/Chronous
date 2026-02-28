from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from ..dependencies import Identity, authenticated_identity, get_gateway
from ..models import FriendRequest, Friendship, Profile
from ..services.capsules import public_error
from ..supabase_gateway import SupabaseError, SupabaseGateway

router = APIRouter(prefix="/v1/friends", tags=["friends"])


@router.get("", response_model=list[Friendship])
async def list_friends(
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> list[Friendship]:
    try:
        rows = await gateway.list_friendships(identity.token, str(identity.user["id"]))
    except SupabaseError as error:
        raise public_error(error) from error
    return [Friendship(**row) for row in rows]


@router.get("/search", response_model=list[Profile])
async def search_friends(
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
    query: Annotated[str, Query(min_length=1, max_length=40, pattern=r"^[a-zA-Z0-9_]+$")],
) -> list[Profile]:
    try:
        rows = await gateway.search_profiles(identity.token, query.lower())
    except SupabaseError as error:
        raise public_error(error) from error
    return [Profile(**row) for row in rows if str(row["id"]) != str(identity.user["id"])]


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_friend_request(
    request: FriendRequest,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> dict:
    try:
        data = await gateway.send_friend_request(identity.token, request.username)
    except SupabaseError as error:
        raise public_error(error) from error
    return {"data": data}


@router.post("/{friendship_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
async def accept_friend_request(
    friendship_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> Response:
    try:
        await gateway.respond_friend_request(identity.token, str(friendship_id), True)
    except SupabaseError as error:
        raise public_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_friendship(
    friendship_id: UUID,
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> Response:
    try:
        await gateway.remove_friendship(identity.token, str(friendship_id))
    except SupabaseError as error:
        raise public_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
