# Submit Mode

Use this mode to stage or publish a reviewed draft in Profile Scribe.

## Procedure

1. Resolve Profile Scribe integration config.
2. Confirm the draft exists and has provenance records.
3. Check submission mode:
   - `draft`: create or update a draft
   - `review`: stage for review without publishing
   - `publish`: publish only when explicitly configured or requested
4. Submit through the configured API or local integration contract.
5. Store a submission receipt in consumer-local state.

## Guardrails

- Default to `draft`.
- Do not publish on ambiguous wording.
- Do not include raw API tokens in logs, prompts, or reports.
- If Profile Scribe integration is unavailable, return the exact draft payload
  and the missing configuration fields.

## Output

Return submission status, Profile Scribe draft ID or URL when available, and
any review blockers.
