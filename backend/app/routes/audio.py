import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from ..config import settings
from ..database import update_session, get_session, save_transcript
from ..auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.post("/upload/{session_id}")
async def upload_audio(session_id: int, file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Save audio file
    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    filename = f"{session_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(settings.AUDIO_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    await update_session(session_id, audio_filename=filename)
    return {"filename": filename, "size_bytes": len(content)}


@router.post("/transcribe/{session_id}")
async def transcribe(session_id: int, language: str = Form("es"), user: CurrentUser = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.get("audio_filename"):
        raise HTTPException(400, "No audio file uploaded for this session")

    audio_path = os.path.join(settings.AUDIO_DIR, session["audio_filename"])
    if not os.path.exists(audio_path):
        raise HTTPException(404, "Audio file not found on disk")

    # Import and call the WAT tool
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "tools"))
    from transcribe_audio import transcribe_audio

    try:
        result = await transcribe_audio(audio_path, language=language)
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")

    transcript = await save_transcript(
        session_id,
        full_text=result["text"],
        language=language,
        service_used="deepgram",
    )

    if result.get("duration"):
        await update_session(session_id, audio_duration_seconds=result["duration"])

    return transcript
