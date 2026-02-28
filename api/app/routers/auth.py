from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..dependencies import Identity, authenticated_identity, bearer_token, get_gateway
from ..models import (
    AuthResponse,
    AuthSession,
    AuthUser,
    CurrentUserResponse,
    MessageResponse,
    PasswordRecoveryRequest,
    Profile,
    RefreshRequest,
    SignInRequest,
    SignUpRequest,
)
from ..supabase_gateway import SupabaseError, SupabaseGateway

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def auth_error(error: SupabaseError) -> HTTPException:
    if error.status_code in {400, 401, 403, 422, 429}:
        code = (
            status.HTTP_401_UNAUTHORIZED if error.status_code in {401, 403} else error.status_code
        )
        return HTTPException(status_code=code, detail=error.message)
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error.message)


def auth_response(payload: dict[str, Any]) -> AuthResponse:
    raw_user = payload.get("user")
    if not isinstance(raw_user, dict) and payload.get("id"):
        raw_user = payload
    user = (
        AuthUser(id=str(raw_user["id"]), email=raw_user.get("email"))
        if isinstance(raw_user, dict) and raw_user.get("id")
        else None
    )
    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    if not access_token or not refresh_token or not user:
        return AuthResponse(session=None, confirmation_required=True)
    expires_at = payload.get("expires_at")
    if not expires_at:
        expires_at = int(datetime.now(UTC).timestamp()) + int(payload.get("expires_in", 3600))
    return AuthResponse(
        session=AuthSession(
            access_token=str(access_token),
            refresh_token=str(refresh_token),
            expires_at=int(expires_at),
            token_type=str(payload.get("token_type") or "bearer"),
            user=user,
        )
    )


@router.post("/sign-up", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def sign_up(
    request: SignUpRequest,
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> AuthResponse:
    try:
        return auth_response(
            await gateway.sign_up(request.display_name, request.email, request.password)
        )
    except SupabaseError as error:
        raise auth_error(error) from error


@router.post("/sign-in", response_model=AuthResponse)
async def sign_in(
    request: SignInRequest,
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> AuthResponse:
    try:
        return auth_response(await gateway.sign_in(request.email, request.password))
    except SupabaseError as error:
        raise auth_error(error) from error


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    request: RefreshRequest,
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> AuthResponse:
    try:
        return auth_response(await gateway.refresh_session(request.refresh_token))
    except SupabaseError as error:
        raise auth_error(error) from error


@router.post(
    "/recover-password",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def recover_password(
    request: PasswordRecoveryRequest,
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> MessageResponse:
    try:
        await gateway.request_password_recovery(request.email)
    except SupabaseError as error:
        if error.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before requesting another recovery email.",
            ) from error
        if error.status_code >= 500:
            raise auth_error(error) from error
        # Keep the response identical when an address is unknown or unavailable.
    return MessageResponse(
        message="If an account exists for that email, a password recovery link is on its way."
    )


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out(
    token: Annotated[str, Depends(bearer_token)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> Response:
    try:
        await gateway.sign_out(token)
    except SupabaseError as error:
        if error.status_code not in {401, 403}:
            raise auth_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=CurrentUserResponse)
async def me(
    identity: Annotated[Identity, Depends(authenticated_identity)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> CurrentUserResponse:
    try:
        profile = await gateway.get_profile(identity.token, str(identity.user["id"]))
    except SupabaseError as error:
        raise auth_error(error) from error
    return CurrentUserResponse(
        user=AuthUser(id=str(identity.user["id"]), email=identity.user.get("email")),
        profile=Profile(**profile),
    )
