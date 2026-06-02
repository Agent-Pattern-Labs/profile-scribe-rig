# Architecture

This harness follows the `create-agentic-harness` pattern from
`/Users/charlie/AgentPatternLabs/Agent-Skills`.

## Split

The harness package owns reusable behavior:

- agent instructions in `iso/`
- workflow procedures in `modes/`
- policy and contracts in `templates/`
- CLIs and sync behavior in `bin/`
- the first-class ProfileScribe MCP integration contract

Consumer projects own private runtime data:

- Profile Scribe config
- crawled sources
- prior posts
- generated drafts
- submission receipts
- `PROFILESCRIBE_AGENT_TOKEN` and any local MCP client config

## Workflow

1. The user provides a topic, draft, or URLs.
2. The harness crawls every URL and stores source records.
3. The harness retrieves and searches prior Profile Scribe posts.
4. The harness builds a compact timeline brief: recent post direction, covered
   sources, repeated openings, duplicate-prone topics, and angles to avoid.
5. The harness ranks source opportunities across the approved source graph so a
   generic post request can discover an under-covered professional angle.
6. The harness builds a compact voice profile.
7. The harness drafts a fresh post in the user's voice.
8. The harness checks duplicate risk, provenance, and privacy before
   submission.
9. The harness stages the draft back to Profile Scribe.

## Integration Boundary

Profile Scribe should be reached through `profilescribe-mcp` by default. The
bridge forwards terminal-agent MCP calls to the hosted ProfileScribe MCP
endpoint and keeps scoped token enforcement in ProfileScribe. REST and local
checkout adapters are fallback paths for development or future integrations.
