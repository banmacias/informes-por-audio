from __future__ import annotations

import aiosqlite
import os
from .config import settings

DB_PATH = settings.DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    session_type TEXT NOT NULL CHECK(session_type IN ('parent_session', 'team_meeting')),
    patient_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    audio_filename TEXT,
    audio_duration_seconds REAL,
    status TEXT DEFAULT 'recorded' CHECK(status IN ('recorded', 'transcribed', 'reported', 'shared')),
    created_by_email TEXT,
    created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    full_text TEXT NOT NULL,
    language TEXT DEFAULT 'es',
    service_used TEXT DEFAULT 'deepgram',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content_markdown TEXT NOT NULL,
    content_html TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await get_db()
    try:
        await db.executescript(SCHEMA)
        await db.commit()
    finally:
        await db.close()


# --- Session CRUD ---

async def create_session(
    title: str,
    session_type: str,
    patient_name: str | None = None,
    created_by_email: str | None = None,
    created_by_name: str | None = None,
) -> dict:
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO sessions (title, session_type, patient_name, created_by_email, created_by_name) VALUES (?, ?, ?, ?, ?)",
            (title, session_type, patient_name, created_by_email, created_by_name),
        )
        await db.commit()
        row = await (await db.execute("SELECT * FROM sessions WHERE id = ?", (cursor.lastrowid,))).fetchone()
        return dict(row)
    finally:
        await db.close()


async def list_sessions() -> list[dict]:
    db = await get_db()
    try:
        rows = await (await db.execute("SELECT * FROM sessions ORDER BY created_at DESC")).fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_session(session_id: int) -> dict | None:
    db = await get_db()
    try:
        row = await (await db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))).fetchone()
        if not row:
            return None
        session = dict(row)

        transcript = await (await db.execute(
            "SELECT * FROM transcripts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,),
        )).fetchone()
        session["transcript"] = dict(transcript) if transcript else None

        report = await (await db.execute(
            "SELECT * FROM reports WHERE session_id = ? ORDER BY version DESC LIMIT 1",
            (session_id,),
        )).fetchone()
        session["report"] = dict(report) if report else None

        return session
    finally:
        await db.close()


async def update_session(session_id: int, **kwargs) -> dict | None:
    db = await get_db()
    try:
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [session_id]
        await db.execute(f"UPDATE sessions SET {sets} WHERE id = ?", values)
        await db.commit()
        return await get_session(session_id)
    finally:
        await db.close()


async def delete_session(session_id: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


# --- Transcript CRUD ---

async def save_transcript(session_id: int, full_text: str, language: str = "es", service_used: str = "deepgram") -> dict:
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO transcripts (session_id, full_text, language, service_used) VALUES (?, ?, ?, ?)",
            (session_id, full_text, language, service_used),
        )
        await db.execute("UPDATE sessions SET status = 'transcribed' WHERE id = ?", (session_id,))
        await db.commit()
        row = await (await db.execute("SELECT * FROM transcripts WHERE id = ?", (cursor.lastrowid,))).fetchone()
        return dict(row)
    finally:
        await db.close()


# --- Report CRUD ---

async def save_report(session_id: int, content_markdown: str, content_html: str | None = None) -> dict:
    db = await get_db()
    try:
        # Get current max version
        row = await (await db.execute(
            "SELECT COALESCE(MAX(version), 0) as max_v FROM reports WHERE session_id = ?",
            (session_id,),
        )).fetchone()
        new_version = row["max_v"] + 1

        cursor = await db.execute(
            "INSERT INTO reports (session_id, content_markdown, content_html, version) VALUES (?, ?, ?, ?)",
            (session_id, content_markdown, content_html, new_version),
        )
        await db.execute("UPDATE sessions SET status = 'reported' WHERE id = ?", (session_id,))
        await db.commit()
        row = await (await db.execute("SELECT * FROM reports WHERE id = ?", (cursor.lastrowid,))).fetchone()
        return dict(row)
    finally:
        await db.close()


async def update_report(report_id: int, content_markdown: str, content_html: str | None = None) -> dict | None:
    db = await get_db()
    try:
        await db.execute(
            "UPDATE reports SET content_markdown = ?, content_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (content_markdown, content_html, report_id),
        )
        await db.commit()
        row = await (await db.execute("SELECT * FROM reports WHERE id = ?", (report_id,))).fetchone()
        return dict(row) if row else None
    finally:
        await db.close()
