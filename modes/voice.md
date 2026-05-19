# Voice Mode

Use this mode to build or refresh the user's Profile Scribe voice profile.

## Procedure

1. Sample prior posts from Profile Scribe or consumer-local exports.
2. Extract style signals:
   - sentence and paragraph length
   - opening patterns
   - pacing and transitions
   - vocabulary and recurring phrases
   - level of directness
   - formatting habits
   - typical endings or calls to action
3. Identify what to avoid:
   - phrases the user does not use
   - generic assistant cadence
   - over-polished marketing tone
   - repeated old anecdotes
4. Save or update `data/voice-profile.json` when the consumer project is
   writable.

## Rules

- Voice is a pattern, not a permission to copy old posts.
- Prefer compact signals over long excerpts.
- If prior posts are unavailable, state that voice matching is low-confidence.

## Output

Return a concise voice profile plus confidence level and examples of style
signals used.
