# History Mode

Use this mode to search previous Profile Scribe posts and detect repetition.

## Procedure

1. Resolve prior-post access through Profile Scribe config.
2. Retrieve the configured number of recent posts and any posts matching the
   current topic, URLs, entities, or tags.
3. Build a compact related-post list with title, date, URL or local ID, topic,
   and relevance reason.
4. Flag duplicate risk:
   - same thesis already posted
   - same source already used
   - same anecdote or story shape repeated recently
   - same call to action repeated recently
5. Pass style-relevant examples to `voice` mode without copying full private
   post bodies into prompts when a compact style profile is enough.

## Output

Return related posts, duplicate risk, and recommended differentiation.
