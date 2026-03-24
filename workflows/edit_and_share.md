# Workflow: Edit Report and Share

## Objective
Allow the therapist to review, edit, and share the generated report via email or WhatsApp.

## Steps

### Editing
1. User views the generated report on the session detail page
2. Taps "Editar" to switch to edit mode (markdown textarea)
3. Makes changes to the report text
4. Auto-saves after 2 seconds of inactivity
5. Taps "Guardar" to save and exit edit mode
6. Can tap "Generar Informe" again to get a fresh AI-generated version

### Sharing via Email
1. User taps "Compartir" button
2. Share modal opens from bottom
3. Enters recipient email address
4. Taps "Enviar"
5. `tools/send_email.py` sends formatted HTML email via Resend
6. Session status updates to `shared`

### Sharing via WhatsApp
1. User taps "Compartir por WhatsApp" in share modal
2. Report text is copied to clipboard
3. WhatsApp opens with a preview message via wa.me link
4. User pastes the full report text in the chat

## Tools Used
- `tools/send_email.py` — Resend API integration

## Expected Output
- Updated report in database (if edited)
- Email sent to recipient (if sharing by email)
- WhatsApp opened with report preview (if sharing by WhatsApp)

## Edge Cases
- **Email delivery fails**: Show error message, user can retry
- **WhatsApp not installed**: wa.me link opens web WhatsApp instead
- **Clipboard API unavailable**: Fallback to selecting text manually
