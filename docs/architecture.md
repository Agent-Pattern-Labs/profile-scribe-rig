# Architecture

This harness follows the `create-agentic-harness` pattern from
`/Users/charlie/AgentPatternLabs/Agent-Skills`.

## Split

The harness package owns reusable behavior:

- agent instructions in `iso/`
- workflow procedures in `modes/`
- policy and contracts in `templates/`
- CLIs and sync behavior in `bin/`

Consumer projects own private runtime data:

- Profile Scribe config
- crawled sources
- prior posts
- generated drafts
- submission receipts

## Workflow

1. The user provides a topic, draft, or URLs.
2. The harness crawls every URL and stores source records.
3. The harness retrieves and searches prior Profile Scribe posts.
4. The harness builds a compact voice profile.
5. The harness drafts a fresh post in the user's voice.
6. The harness checks duplicate risk, provenance, and privacy.
7. The harness stages the draft back to Profile Scribe.

## Integration Boundary

Profile Scribe can be reached through a local checkout or an API. The harness
should discover integration settings from consumer config and environment
variables, never from a personal path.
