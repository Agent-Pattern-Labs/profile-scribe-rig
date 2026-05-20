# Compose Mode

Use this mode for the full Profile Scribe post creation workflow.

## Inputs

- User topic, rough draft, note, or instruction, if supplied.
- Any supplied URLs, if supplied.
- Consumer Profile Scribe config.
- ProfileScribe profile, approved sources, source activity, and prior posts from
  ProfileScribe MCP.

## Procedure

1. Resolve ProfileScribe MCP configuration. If `profilescribe-mcp` or
   `PROFILESCRIBE_AGENT_TOKEN` is missing, stop with exact setup instructions.
2. Call `read_profile` and `read_sources` before deciding what to post.
3. If the request includes URLs, route URL collection through `crawl` mode
   behavior and preserve failures.
4. If the request does not include URLs, inspect approved sources and recent
   source state:
   - use source checkpoint/observation/fact-candidate tools when available
   - use timeline search/discovery when available to avoid repeating posts
   - choose a specific source-backed update or stop with "no post-worthy update"
5. Search prior posts using `history` mode behavior. Record related posts and
   possible duplicate topics.
6. Build or refresh the voice profile using `voice` mode behavior.
7. Draft a new post with:
   - one clear point of view
   - source-backed facts
   - the user's observed voice
   - no heavy copying from prior posts
   - normal first-person professional wording suitable for a LinkedIn feed
   - no visible planning language, prompt constraints, crawl narration, or
     provenance/audit labels in the public body
8. Run checks:
   - all crawled claims have provenance
   - duplicate risk is acceptable or called out
   - voice does not drift into generic assistant prose
   - the draft reads like the profile owner wrote it for people, not like an
     agent thinking out loud
   - the public body does not contain phrases such as "approved sources",
     "source-backed", "crawl summary", "public claim", "this post should", or
     "timeline context"
   - private tokens, cookies, and raw credentials are absent
9. For normal autonomous posting, call `create_source_backed_timeline_post` with
   the chosen topic/tone/source IDs. Use local draft text as planning context
   and pass tone guidance that requests concise first-person professional copy;
   the hosted ProfileScribe tool owns final source-backed publication.
10. If no specific, meaningful update exists, do not post. Return the source
   checks performed and the reason no post was created.

## Output

Return:

- draft text
- source summary
- prior-post/voice summary
- duplicate risk
- submission status or next action
