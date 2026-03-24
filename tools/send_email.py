"""WAT Tool: Send report via email using Resend API."""

import resend
import os
import markdown
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")


async def send_report_email(
    to_email: str,
    subject: str,
    report_markdown: str,
    patient_name: str | None = None,
) -> dict:
    """
    Send a report via email using Resend.

    Args:
        to_email: Recipient email address
        subject: Email subject
        report_markdown: Report content in markdown format
        patient_name: Optional patient name for personalization

    Returns:
        dict with 'id' (Resend email ID)
    """
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY not set in environment")

    resend.api_key = RESEND_API_KEY

    # Convert markdown to HTML for email body
    report_html = markdown.markdown(report_markdown, extensions=["tables"])

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f0f4f8; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #1a365d;">📋 Informes por Audio</h2>
            <p style="margin: 4px 0 0; color: #4a5568; font-size: 14px;">{subject}</p>
        </div>
        <div style="line-height: 1.6; color: #2d3748;">
            {report_html}
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; color: #a0aec0;">
            Este informe fue generado automáticamente por Informes por Audio.
        </p>
    </div>
    """

    result = resend.Emails.send({
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    })

    return {"id": result.get("id", "")}
