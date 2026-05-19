# Modes

Mode files keep the always-loaded harness context small. The router loads
`modes/_shared.md` plus exactly one active mode file.

- `compose.md`: full end-to-end post workflow.
- `crawl.md`: crawl and extract supplied URLs.
- `history.md`: search prior posts and detect duplicates.
- `voice.md`: build or refresh the user's writing voice profile.
- `submit.md`: stage or publish a reviewed draft to Profile Scribe.
- `reference-profile-scribe.md`: integration details loaded only when needed.
