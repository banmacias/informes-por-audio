# Workflow: Record a Therapy Session

## Objective
Capture audio from a therapy session using the web app's recording feature.

## Required Inputs
- Session title
- Session type: `parent_session` or `team_meeting`
- Patient name (optional, for parent sessions)

## Steps
1. User opens the app on their phone
2. Taps "Grabar" (Record) in the bottom nav
3. Selects session type (parent session or team meeting)
4. Enters session title and patient name
5. Taps the red record button
6. App requests microphone permission (first time only)
7. Recording begins — timer shows elapsed time
8. When done, user taps the stop button
9. Audio preview plays back for verification
10. User taps "Subir y Transcribir" to proceed

## Tools Used
- Browser MediaRecorder API (frontend)
- `tools/save_audio.py` (backend)

## Expected Output
- Audio file saved to `data/audio/`
- New session created in database with status `recorded`

## Edge Cases
- **iOS Safari**: Recording requires a direct button tap (user gesture)
- **Long recordings (50+ min)**: Audio is chunked every 10 seconds to prevent memory issues
- **Microphone denied**: Show alert asking user to allow microphone access
- **Network lost during upload**: Show error, keep audio blob in memory for retry
