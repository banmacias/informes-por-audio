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


@router.post("/from-drive")
async def from_drive(body: DriveRequest, user: CurrentUser = Depends(get_current_user)):
    url = body.url.strip()
    file_id = _extract_drive_file_id(url)
    if not file_id:
        raise HTTPException(400, "No se pudo extraer el ID del archivo de Google Drive")

    # Determine if it's a Google Doc or a Drive file (PDF, etc.)
    is_google_doc = "docs.google.com/document" in url

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        if is_google_doc:
            # Google Docs export as plain text (works for files shared as "anyone with link")
            export_url = f"https://docs.google.com/document/d/{file_id}/export?format=txt"
            resp = await client.get(export_url)
            if resp.status_code == 401 or resp.status_code == 403:
                raise HTTPException(403, "El documento no es accesible. Asegúrate de que esté compartido como 'Cualquiera con el enlace puede ver'.")
            if resp.status_code != 200:
                raise HTTPException(400, f"No se pudo acceder al documento ({resp.status_code}).")
            return {"text": resp.text.strip()}
        else:
            # PDF or other file hosted in Drive
            download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            resp = await client.get(download_url)
            if resp.status_code == 401 or resp.status_code == 403:
                raise HTTPException(403, "El archivo no es accesible. Asegúrate de que esté compartido como 'Cualquiera con el enlace puede ver'.")
            if resp.status_code != 200:
                raise HTTPException(400, f"No se pudo descargar el archivo ({resp.status_code}).")
            content_type = resp.headers.get("content-type", "")
            if "pdf" in content_type or url.lower().endswith(".pdf"):
                try:
                    text = _pdf_bytes_to_text(resp.content)
                except Exception as e:
                    raise HTTPException(500, f"No se pudo leer el PDF: {e}")
                return {"text": text}
            # Plain text fallback
            return {"text": resp.text.strip()}
