# Compose Mode

Use this mode for the full Profile Scribe post creation workflow.

## Inputs

- User topic, rough draft, note, or instruction.
- Any supplied URLs.
- Consumer Profile Scribe config.
- Prior posts from Profile Scribe or a consumer-local export.

## Procedure

1. Resolve Profile Scribe configuration. If neither a local root nor API URL is
   configured, stop with exact setup instructions.
2. Extract URLs from the request. Route URL collection through `crawl` mode
   behavior and preserve failures.
3. Search prior posts using `history` mode behavior. Record related posts and
   possible duplicate topics.
4. Build or refresh the voice profile using `voice` mode behavior.
5. Draft a new post with:
   - one clear point of view
   - source-backed facts
   - the user's observed voice
   - no heavy copying from prior posts
6. Run checks:
   - all crawled claims have provenance
   - duplicate risk is acceptable or called out
   - voice does not drift into generic assistant prose
   - private tokens, cookies, and raw credentials are absent
7. Save or return the draft in the consumer project.
8. If the user asked to submit, continue to `submit` mode. Otherwise leave the
   post staged for review.

## Output

Return:

- draft text
- source summary
- prior-post/voice summary
- duplicate risk
- submission status or next action
