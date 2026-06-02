# History Mode

Use this mode to search previous Profile Scribe posts and detect repetition.

## Procedure

1. Resolve prior-post access through ProfileScribe MCP first. Use REST or local
   exports only as fallback paths.
2. Retrieve or search the user's timeline posts when the MCP/API exposes them.
   If only global search is available, search for the user's profile terms,
   source labels, source URLs, entities, and candidate topic.
3. Retrieve the configured number of recent posts and any posts matching the
   current topic, URLs, entities, source IDs, or tags.
4. Build a compact related-post list with title, date, URL or local ID, topic,
   and relevance reason.
5. Build a compact timeline brief before drafting:
   - recent posts and their topics
   - sources already covered recently
   - repeated titles, openings, claims, and story shapes
   - recurring terms that describe the current direction of the timeline
   - angles the next post should avoid unless it has new evidence
6. Rank source opportunities before drafting:
   - prefer approved sources not represented in recent posts
   - prefer recently checked or high-trust sources with concrete public content
   - demote sources that already appear repeatedly unless a new angle is clear
   - keep explicit user topic/source matches high in the queue
7. Flag duplicate risk:
   - same thesis already posted
   - same source already used
   - same anecdote or story shape repeated recently
   - same call to action repeated recently
8. Pass style-relevant examples to `voice` mode without copying full private
   post bodies into prompts when a compact style profile is enough.

## Output

Return related posts, timeline direction, ranked source opportunities, duplicate
risk, and recommended differentiation.
