"""WAT Tool: Transcribe audio using Deepgram API."""

import httpx
import os
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


async def transcribe_audio(audio_path: str, language: str = "es") -> dict:
    """
    Transcribe an audio file using Deepgram nova-2 model.

    Args:
        audio_path: Path to the audio file
        language: Language code (default: 'es' for Spanish)

    Returns:
        dict with 'text' (full transcript) and 'duration' (seconds)
    """
    if not DEEPGRAM_API_KEY:
        raise ValueError("DEEPGRAM_API_KEY not set in environment")

    # Determine MIME type from extension
    ext = os.path.splitext(audio_path)[1].lower()
    mime_types = {
        ".webm": "audio/webm",
        ".mp4": "audio/mp4",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
    }
    content_type = mime_types.get(ext, "audio/webm")

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    params = {
        "model": "nova-2",
        "language": language,
        "punctuate": "true",
        "paragraphs": "true",
        "smart_format": "true",
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            DEEPGRAM_URL,
            params=params,
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": content_type,
            },
            content=audio_data,
        )
        response.raise_for_status()
        data = response.json()

    result = data.get("results", {})
    channels = result.get("channels", [{}])
    alternatives = channels[0].get("alternatives", [{}]) if channels else [{}]
    transcript_text = alternatives[0].get("transcript", "") if alternatives else ""

    # Try to get paragraphs for better formatting
    paragraphs = alternatives[0].get("paragraphs", {}).get("paragraphs", []) if alternatives else []
    if paragraphs:
        formatted_parts = []
        for para in paragraphs:
            sentences = para.get("sentences", [])
            para_text = " ".join(s.get("text", "") for s in sentences)
            formatted_parts.append(para_text)
        transcript_text = "\n\n".join(formatted_parts)

    duration = result.get("metadata", {}).get("duration", 0)

    return {
        "text": transcript_text,
        "duration": duration,
    }
