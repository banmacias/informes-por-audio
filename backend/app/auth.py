from __future__ import annotations

from fastapi import Header, HTTPException
from .config import settings


class CurrentUser:
    def __init__(self, email: str, name: str):
        self.email = email
        self.name = name


async def get_current_user(
    x_api_key: str = Header(default=""),
    x_user_email: str = Header(default=""),
    x_user_name: str = Header(default=""),
) -> CurrentUser:
    # If no API_SECRET is configured, allow all (dev mode)
    if settings.API_SECRET and x_api_key != settings.API_SECRET:
        raise HTTPException(401, "Invalid API key")

    if not x_user_email:
        raise HTTPException(401, "Not authenticated")

    return CurrentUser(email=x_user_email, name=x_user_name or x_user_email)
