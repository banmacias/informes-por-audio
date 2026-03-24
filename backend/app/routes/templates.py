from __future__ import annotations

import io
import re
import httpx
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
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


def _extract_drive_file_id(url: str) -> str | None:
    for pattern in [
        r"/document/d/([a-zA-Z0-9_-]+)",
        r"/file/d/([a-zA-Z0-9_-]+)",
        r"[?&]id=([a-zA-Z0-9_-]+)",
        r"^([a-zA-Z0-9_-]{25,})$",
    ]:
        m = re.search(pattern, url.strip())
        if m:
            return m.group(1)
    return None


def _pdf_bytes_to_text(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


@router.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se admiten archivos PDF")
    content = await file.read()
    try:
        text = _pdf_bytes_to_text(content)
    except Exception as e:
        raise HTTPException(500, f"No se pudo leer el PDF: {e}")
    if not text:
        raise HTTPException(400, "El PDF no contiene texto extraíble")
    return {"text": text, "filename": file.filename}


class DriveRequest(BaseModel):
    url: str
    access_token: str


@router.post("/from-drive")
async def from_drive(body: DriveRequest, user: CurrentUser = Depends(get_current_user)):
    file_id = _extract_drive_file_id(body.url)
    if not file_id:
        raise HTTPException(400, "No se pudo extraer el ID del archivo de Google Drive")

    headers = {"Authorization": f"Bearer {body.access_token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        # Get file metadata
        meta = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{file_id}",
            params={"fields": "mimeType,name"},
            headers=headers,
        )
        if meta.status_code == 401:
            raise HTTPException(401, "Sesión de Google expirada. Cierra sesión y vuelve a entrar.")
        if meta.status_code != 200:
            raise HTTPException(400, f"No se pudo acceder al archivo ({meta.status_code}). Verifica que el enlace sea correcto y que tengas acceso.")

        info = meta.json()
        mime = info.get("mimeType", "")
        name = info.get("name", "")

        if mime == "application/vnd.google-apps.document":
            resp = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}/export",
                params={"mimeType": "text/plain"},
                headers=headers,
            )
            if resp.status_code != 200:
                raise HTTPException(400, "No se pudo exportar el documento")
            return {"text": resp.text.strip(), "filename": name}

        elif mime == "application/pdf":
            resp = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                params={"alt": "media"},
                headers=headers,
            )
            if resp.status_code != 200:
                raise HTTPException(400, "No se pudo descargar el PDF")
            try:
                text = _pdf_bytes_to_text(resp.content)
            except Exception as e:
                raise HTTPException(500, f"No se pudo leer el PDF: {e}")
            return {"text": text, "filename": name}

        else:
            raise HTTPException(400, "Solo se admiten Google Docs y PDFs de Drive")
