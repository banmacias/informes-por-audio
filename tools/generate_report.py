"""WAT Tool: Generate a structured clinical report from a transcript using Claude API."""
from __future__ import annotations

import anthropic
import os
import markdown
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

PARENT_SESSION_TEMPLATE = """Eres una asistente de documentación clínica para terapeutas del lenguaje infantil.
Tu trabajo es generar un informe estructurado a partir de la transcripción de una sesión de terapia.

El informe debe estar en español y seguir esta estructura:

# Informe de Sesión

**Paciente:** {patient_name}
**Fecha:** {date}
**Tipo:** Sesión con padres

## Objetivos de la Sesión
(Extrae los objetivos mencionados o inferidos de la transcripción)

## Actividades Realizadas
(Lista las actividades o ejercicios mencionados durante la sesión)

## Observaciones y Progreso
(Resume las observaciones del terapeuta sobre el progreso del niño/a)

## Conversación con Padres
(Resume los puntos clave discutidos con los padres)

## Recomendaciones para Casa
(Lista las recomendaciones o ejercicios que los padres deben hacer en casa)

## Próximos Pasos
(Define los objetivos o planes para la próxima sesión)

---
Instrucciones:
- Usa lenguaje clínico pero accesible
- Si la información no está en la transcripción, omite la sección en lugar de inventar
- Sé concisa pero completa
- Usa viñetas cuando sea apropiado"""

TEAM_MEETING_TEMPLATE = """Eres una asistente de documentación clínica para un equipo de terapeutas del lenguaje infantil.
Tu trabajo es generar un informe estructurado de la reunión de equipo a partir de la transcripción.

El informe debe estar en español y seguir esta estructura:

# Informe de Reunión de Equipo

**Fecha:** {date}

## Pacientes Discutidos
(Lista de pacientes mencionados con un breve resumen de lo discutido para cada uno)

## Acuerdos y Decisiones
(Lista los acuerdos tomados durante la reunión)

## Seguimientos Pendientes
(Acciones pendientes, quién es responsable, y plazos si se mencionan)

## Notas Adicionales
(Cualquier otro punto relevante discutido)

---
Instrucciones:
- Organiza por paciente cuando sea posible
- Usa lenguaje clínico pero accesible
- Si la información no está clara en la transcripción, indica que necesita confirmación
- Sé concisa pero completa"""


async def generate_report(
    transcript: str,
    session_type: str = "parent_session",
    patient_name: str | None = None,
) -> dict:
    """
    Generate a structured clinical report from a transcript.

    Args:
        transcript: The full text transcript
        session_type: 'parent_session' or 'team_meeting'
        patient_name: Patient name (for parent sessions)

    Returns:
        dict with 'markdown' and 'html' keys
    """
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set in environment")

    from datetime import date
    today = date.today().strftime("%d/%m/%Y")

    if session_type == "team_meeting":
        system_prompt = TEAM_MEETING_TEMPLATE.format(date=today)
    else:
        system_prompt = PARENT_SESSION_TEMPLATE.format(
            patient_name=patient_name or "(No especificado)",
            date=today,
        )

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Genera el informe a partir de la siguiente transcripción de la sesión:\n\n{transcript}",
            }
        ],
    )

    report_markdown = message.content[0].text

    # Convert markdown to HTML
    report_html = markdown.markdown(report_markdown, extensions=["tables", "fenced_code"])

    return {
        "markdown": report_markdown,
        "html": report_html,
    }
