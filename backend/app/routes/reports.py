from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import get_session, save_report, update_report, get_template
from ..auth import get_current_user, CurrentUser
import os

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportUpdate(BaseModel):
    content_markdown: str
    content_html: Optional[str] = None


class GenerateRequest(BaseModel):
    template_id: Optional[int] = None


@router.post("/generate/{session_id}")
async def generate(session_id: int, body: GenerateRequest = GenerateRequest(), user: CurrentUser = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.get("transcript"):
        raise HTTPException(400, "No transcript available. Transcribe audio first.")

    # Look up template content if template_id provided
    template_content = None
    if body.template_id:
        template = await get_template(body.template_id)
        if template:
            template_content = template["content"]

    # Import and call the WAT tool
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "tools"))
    from generate_report import generate_report

    try:
        result = await generate_report(
            transcript=session["transcript"]["full_text"],
            session_type=session["session_type"],
            patient_name=session.get("patient_name"),
            template_content=template_content,
        )
    except Exception as e:
        raise HTTPException(500, f"Report generation failed: {str(e)}")

    report = await save_report(
        session_id,
        content_markdown=result["markdown"],
        content_html=result.get("html"),
    )
    return report


@router.put("/{report_id}")
async def update(report_id: int, data: ReportUpdate, user: CurrentUser = Depends(get_current_user)):
    result = await update_report(report_id, data.content_markdown, data.content_html)
    if not result:
        raise HTTPException(404, "Report not found")
    return result
