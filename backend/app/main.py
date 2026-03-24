from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init_db
from .routes import sessions, audio, reports, sharing


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Informes por Audio API",
    description="Backend API for audio-based therapy session reports",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(sessions.router)
app.include_router(audio.router)
app.include_router(reports.router)
app.include_router(sharing.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
