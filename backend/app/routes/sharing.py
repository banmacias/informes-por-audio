from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import get_session, update_session
from ..auth import get_current_user, CurrentUser
import os

router = APIRouter(prefix="/api/share", tags=["sharing"])


class EmailRequest(BaseModel):
    session_id: int
    to_email: str
    subject: Optional[str] = None


@router.post("/email")
async def send_email(data: EmailRequest, user: CurrentUser = Depends(get_current_user)):
    session = await get_session(data.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.get("report"):
        raise HTTPException(400, "No report available to share")

    # Import and call the WAT tool
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "tools"))
    from send_email import send_report_email

    subject = data.subject or f"Informe de sesión: {session['title']}"

    try:
        result = await send_report_email(
            to_email=data.to_email,
            subject=subject,
            report_markdown=session["report"]["content_markdown"],
            patient_name=session.get("patient_name"),
        )
    except Exception as e:
        raise HTTPException(500, f"Email sending failed: {str(e)}")

    await update_session(data.session_id, status="shared")
    return {"ok": True, "email_id": result.get("id")}


@router.get("/whatsapp/{session_id}")
async def whatsapp_link(session_id: int, user: CurrentUser = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.get("report"):
        raise HTTPException(400, "No report available to share")

    # Build a short summary for WhatsApp (full report is too long)
    report_text = session["report"]["content_markdown"]
    # Take first 500 chars as preview
    preview = report_text[:500].replace("\n", " ").strip()
    if len(report_text) > 500:
        preview += "..."

    import urllib.parse
    message = f"📋 {session['title']}\n\n{preview}"
    encoded = urllib.parse.quote(message)

    return {
        "whatsapp_url": f"https://wa.me/?text={encoded}",
        "full_text": report_text,
    }
