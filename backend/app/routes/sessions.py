from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import create_session, list_sessions, get_session, update_session, delete_session
from ..auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    title: str
    session_type: str  # 'parent_session' | 'team_meeting'
    patient_name: Optional[str] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    patient_name: Optional[str] = None
    status: Optional[str] = None


@router.post("")
async def create(data: SessionCreate, user: CurrentUser = Depends(get_current_user)):
    if data.session_type not in ("parent_session", "team_meeting"):
        raise HTTPException(400, "session_type must be 'parent_session' or 'team_meeting'")
    return await create_session(
        data.title,
        data.session_type,
        data.patient_name,
        created_by_email=user.email,
        created_by_name=user.name,
    )


@router.get("")
async def list_all(user: CurrentUser = Depends(get_current_user)):
    return await list_sessions()


@router.get("/{session_id}")
async def get_one(session_id: int, user: CurrentUser = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.patch("/{session_id}")
async def update(session_id: int, data: SessionUpdate, user: CurrentUser = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    result = await update_session(session_id, **updates)
    if not result:
        raise HTTPException(404, "Session not found")
    return result


@router.delete("/{session_id}")
async def delete(session_id: int, user: CurrentUser = Depends(get_current_user)):
    if not await delete_session(session_id):
        raise HTTPException(404, "Session not found")
    return {"ok": True}
