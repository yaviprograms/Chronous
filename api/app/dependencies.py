from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings
from .supabase_gateway import SupabaseError, SupabaseGateway


@dataclass(frozen=True)
class Identity:
    token: str
    user: dict[str, Any]


def get_gateway(settings: Annotated[Settings, Depends(get_settings)]) -> SupabaseGateway:
    return SupabaseGateway(settings)


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="An access token is required.",
        )
    return token.strip()


async def authenticated_identity(
    token: Annotated[str, Depends(bearer_token)],
    gateway: Annotated[SupabaseGateway, Depends(get_gateway)],
) -> Identity:
    try:
        user = await gateway.get_user(token)
    except SupabaseError as error:
        if error.status_code in {400, 401, 403}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your session is invalid or expired.",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error.message,
        ) from error
    if not user.get("id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session.")
    return Identity(token=token, user=user)
