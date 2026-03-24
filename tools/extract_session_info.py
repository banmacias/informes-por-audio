"""WAT Tool: Extract session metadata (title, patient name) from a transcript using Claude API."""
from __future__ import annotations

import anthropic
import os
import json
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


async def extract_session_info(
    transcript: str,
    session_type: str = "parent_session",
) -> dict:
    """
    Extract title and patient name from a transcript.

    Returns:
        dict with 'title' and optionally 'patient_name'
    """
    if not ANTHROPIC_API_KEY:
        return {}

    from datetime import date
    today = date.today().strftime("%d/%m/%Y")

    if session_type == "team_meeting":
        prompt = f"""A partir de esta transcripción de una reunión de equipo de terapeutas del lenguaje,
extrae la información solicitada y responde ÚNICAMENTE con un JSON válido, sin texto adicional.

Transcripción:
{transcript[:3000]}

Responde con este JSON exacto:
{{
  "title": "Reunión de equipo {today}"
}}

Reglas:
- El título debe ser siempre "Reunión de equipo" seguido de la fecha {today}
- No incluyas ningún texto fuera del JSON"""
    else:
        prompt = f"""A partir de esta transcripción de una sesión de terapia del lenguaje infantil,
extrae la información solicitada y responde ÚNICAMENTE con un JSON válido, sin texto adicional.

Transcripción:
{transcript[:3000]}

Responde con este JSON exacto (sin comentarios, sin texto extra):
{{
  "title": "Sesión [Nombre del paciente] - [Fecha {today}]",
  "patient_name": "[nombre completo del paciente/niño mencionado]"
}}

Reglas:
- title: "Sesión " + nombre del paciente + " - " + fecha {today}
- patient_name: nombre del niño/paciente tal como se menciona en la transcripción
- Si no se menciona el nombre del paciente, usa "Sesión {today}" como título y omite patient_name
- No incluyas ningún texto fuera del JSON"""

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
