# Submit Mode

Use this mode to stage or publish a reviewed draft in Profile Scribe.

## Procedure

1. Resolve Profile Scribe integration config.
2. Confirm the draft exists and has provenance records.
3. Check submission mode:
   - `draft`: create or update a draft
   - `review`: stage for review without publishing
   - `publish`: publish only when explicitly configured or requested
4. Prefer ProfileScribe MCP submission through `profilescribe-mcp`:
   - first source-backed post: `create_first_post_from_sources`
   - normal follow-up post: `create_source_backed_timeline_post` with the final
     harness-drafted `body`, `abstracts`, topic, tone, and selected source IDs
     that directly substantiate the final public body
   - raw draft: `create_timeline_draft` only with valid ActionProof
   When the user says "create a post" without URLs, call
   `create_source_backed_timeline_post` after composing final public copy from
   ProfileScribe profile/source/history context; do not require user-supplied
   URLs. Do not use hosted copy generation as a fallback unless the user
   explicitly asks ProfileScribe to draft the copy.
5. Fall back to a configured REST API or local integration contract only when
   MCP is unavailable and the adapter exposes the required posting controls.
6. Store a submission receipt in consumer-local state.

## Guardrails

- Default to `draft`.
- Do not publish on ambiguous wording.
- Do not include raw API tokens in logs, prompts, or reports.
- Do not submit public body text that reads like source-check reasoning,
  duplicate-avoidance notes, or prompt instructions.
- Do not submit extra source IDs for adjacent context. If a selected source does
  not support a specific sentence or claim in the final body, remove it or
  revise the body before submission.
- A bearer token alone is not enough for raw `create_timeline_draft` in
  production; use hosted source-backed tools unless valid ActionProof is
  available.
- If `create_source_backed_timeline_post` does not accept `body` and
  `abstracts`, report that the ProfileScribe integration is too old for
  harness-authored posting.
- If Profile Scribe integration is unavailable, return the exact draft payload
  and the missing configuration fields.

## Output

Return submission status, Profile Scribe draft ID or URL when available, and
any review blockers.
