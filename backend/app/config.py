from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")

    # Paths
    DATA_DIR: str = os.getenv("DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"))
    DB_PATH: str = os.path.join(DATA_DIR, "app.db")
    AUDIO_DIR: str = os.path.join(DATA_DIR, "audio")

    # Auth
    API_SECRET: str = os.getenv("API_SECRET", "")

    # CORS
    ALLOWED_ORIGINS: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",")


settings = Settings()

# Ensure directories exist
os.makedirs(settings.AUDIO_DIR, exist_ok=True)
