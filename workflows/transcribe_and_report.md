# Workflow: Transcribe Audio and Generate Report

## Objective
Convert recorded audio to text using Deepgram, then generate a structured clinical report using Claude.

## Required Inputs
- Session ID with uploaded audio file
- Language (default: Spanish `es`)

## Steps
1. Backend receives transcription request for a session
2. `tools/transcribe_audio.py` sends audio file to Deepgram API
   - Model: nova-2
   - Language: es (Spanish)
   - Features: punctuate, paragraphs, smart_format
3. Transcript text is saved to database
4. Session status updates to `transcribed`
5. `tools/generate_report.py` sends transcript to Claude Haiku
   - Uses appropriate template based on session_type
   - Parent sessions: clinical note structure
   - Team meetings: meeting minutes structure
6. Report markdown + HTML saved to database
7. Session status updates to `reported`

## Tools Used
- `tools/transcribe_audio.py` — Deepgram API integration
- `tools/generate_report.py` — Claude Haiku API integration

## Expected Output
- Transcript in database (full text, language, service used)
- Report in database (markdown + HTML, versioned)

## Cost per Session
- Deepgram: ~$0.26 per 60-minute recording (free credits: $200)
- Claude Haiku: ~$0.01 per report

## Edge Cases
- **Transcription fails**: Return error to frontend, user can retry
- **Poor audio quality**: Deepgram nova-2 handles noise well, but inform user to hold phone close
- **Very long recordings**: Deepgram accepts up to 2GB, no practical limit
- **Report quality**: User can regenerate report or edit manually
