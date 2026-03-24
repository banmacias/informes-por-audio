from __future__ import annotations

import aiosqlite
import os
from .config import settings

DB_PATH = settings.DB_PATH

AYOOK_TEMPLATE = """Eres una asistente de documentación clínica para el Centro Ayook de Lenguaje, Habla y Aprendizaje.
Genera un informe clínico formal en español a partir de la transcripción, siguiendo exactamente esta estructura:

---

**PACIENTE:** {patient_name}
**FECHA:** {date}
**EDAD CRONOLÓGICA:** (extrae de la transcripción o deja en blanco)
**DX:** (extrae el diagnóstico de la transcripción o deja en blanco)

(Párrafo de apertura: motivo de consulta, breve descripción del caso y por qué asiste al centro)

**Dificultades identificadas:**
- (lista de dificultades concretas observadas o reportadas)

**Plan de Intervención:**
❖ (objetivos e intervenciones planificadas)

(Párrafo de progreso actual: descripción narrativa del avance del paciente en las áreas trabajadas)

**Conclusión:**
(párrafo de conclusión clínica)

**Recomendaciones:**
- (lista de recomendaciones para casa o seguimiento)

---
Lic. Fernanda Cárdenas Trigo
Cédula Profesional 12852000

---
Instrucciones:
- Usa lenguaje clínico formal
- Si la información no está en la transcripción, omite el campo en lugar de inventar
- Mantén un tono profesional y objetivo
- Las viñetas de dificultades deben ser concretas y observables
- El Plan de Intervención debe usar el símbolo ❖ como viñeta"""

SCHEMA = """
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    session_type TEXT NOT NULL CHECK(session_type IN ('parent_session', 'team_meeting', 'any')),
    content TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
        # Seed default Ayook template if no templates exist
        row = await (await db.execute("SELECT COUNT(*) as n FROM templates")).fetchone()
        if row["n"] == 0:
            await db.execute(
                "INSERT INTO templates (name, description, session_type, content, is_default) VALUES (?, ?, ?, ?, 1)",
                (
                    "Informe Ayook",
                    "Plantilla oficial del Centro Ayook de Lenguaje, Habla y Aprendizaje",
                    "parent_session",
                    AYOOK_TEMPLATE,
                ),
            )
            await db.commit()
    finally:
        await db.close()


# --- Template CRUD ---

async def list_templates() -> list[dict]:
    db = await get_db()
    try:
        rows = await (await db.execute("SELECT * FROM templates ORDER BY is_default DESC, name ASC")).fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_template(template_id: int) -> dict | None:
    db = await get_db()
    try:
        row = await (await db.execute("SELECT * FROM templates WHERE id = ?", (template_id,))).fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def create_template(name: str, content: str, session_type: str = "any", description: str | None = None) -> dict:
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO templates (name, description, session_type, content) VALUES (?, ?, ?, ?)",
            (name, description, session_type, content),
        )
        await db.commit()
        row = await (await db.execute("SELECT * FROM templates WHERE id = ?", (cursor.lastrowid,))).fetchone()
        return dict(row)
    finally:
        await db.close()


async def update_template(template_id: int, **kwargs) -> dict | None:
    db = await get_db()
    try:
        kwargs["updated_at"] = "CURRENT_TIMESTAMP"
        sets = ", ".join(f"{k} = {'CURRENT_TIMESTAMP' if v == 'CURRENT_TIMESTAMP' else '?'}" for k, v in kwargs.items())
        values = [v for v in kwargs.values() if v != "CURRENT_TIMESTAMP"] + [template_id]
        await db.execute(f"UPDATE templates SET {sets} WHERE id = ?", values)
        await db.commit()
        return await get_template(template_id)
    finally:
        await db.close()


async def delete_template(template_id: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM templates WHERE id = ? AND is_default = 0", (template_id,))
        await db.commit()
        return cursor.rowcount > 0
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
