from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import list_templates, get_template, create_template, update_template, delete_template
from ..auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateCreate(BaseModel):
    name: str
    content: str
    session_type: str = "any"
    description: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    session_type: Optional[str] = None
    description: Optional[str] = None


@router.get("")
async def list_all(user: CurrentUser = Depends(get_current_user)):
    return await list_templates()


@router.get("/{template_id}")
async def get_one(template_id: int, user: CurrentUser = Depends(get_current_user)):
    template = await get_template(template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    return template


@router.post("")
async def create(data: TemplateCreate, user: CurrentUser = Depends(get_current_user)):
    return await create_template(
        name=data.name,
        content=data.content,
        session_type=data.session_type,
        description=data.description,
    )


@router.put("/{template_id}")
async def update(template_id: int, data: TemplateUpdate, user: CurrentUser = Depends(get_current_user)):
    template = await get_template(template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return template
    return await update_template(template_id, **updates)


@router.delete("/{template_id}")
async def delete(template_id: int, user: CurrentUser = Depends(get_current_user)):
    ok = await delete_template(template_id)
    if not ok:
        raise HTTPException(400, "Cannot delete this template (not found or is the default)")
    return {"ok": True}
