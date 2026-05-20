# ProfileScribe MCP

`profilescribe-mcp` is the first-class bridge between this harness and
ProfileScribe. The harness owns orchestration, crawling, voice matching, and
posting policy. The MCP bridge owns terminal-agent transport to the hosted
ProfileScribe MCP endpoint. The ProfileScribe app owns the actual tool behavior,
permissions, storage, hosted source-backed posting, and ActionProof checks.

## Repositories

- Harness: `/Users/charlie/AgentPatternLabs/profile-scribe-rig`
- MCP bridge: `/Users/charlie/AgentPatternLabs/profilescribe-mcp`
- ProfileScribe app/API: `/Users/charlie/AgentPatternLabs/profile-scribe`

## Install

```bash
go install github.com/razroo/profilescribe-mcp/cmd/profilescribe-mcp@latest
```

Configure the agent runtime to run:

```text
profilescribe-mcp
```

Required environment:

```bash
PROFILESCRIBE_AGENT_TOKEN=psagt_...
PROFILESCRIBE_MCP_URL=https://profilescribe.com/api/mcp
```

For local app development, use:

```bash
PROFILESCRIBE_API_URL=http://localhost:8080
```

## Token Scopes

Create the token in ProfileScribe at `/agents`.

Minimum scopes for posting through this harness:

- `mcp:tools`
- `read:profile`
- `read:sources`
- `observe:sources`
- `write:drafts`

Optional scopes:

- `read:timeline` for timeline discovery/search
- `interact:timeline` for likes and comments
- `write:sources` for adding or updating approved sources
- `propose:profile` for review-only profile edit proposals

## Posting Tools

Use `read_profile` and `read_sources` before drafting or posting. A user should
be able to say "create a post" without supplying URLs. In that case, inspect the
ProfileScribe profile, approved sources, source activity, and prior timeline
context, then decide whether there is a specific source-backed update worth
posting.

Use `create_first_post_from_sources` only for a profile's first source-backed
timeline post. It is a bootstrap path and should not be used for routine source
updates.

Use `create_source_backed_timeline_post` for normal follow-up posts. This is the
default hosted path for concrete, meaningful updates grounded in approved
ProfileScribe sources. Pass `sourceIds` when the agent has selected specific
approved sources; otherwise let ProfileScribe rank current sources from the
profile. Choose a topic and tone that request concise first-person professional
copy. Keep source checks, duplicate checks, and provenance language out of the
public body.

Use raw `create_timeline_draft` only when the runtime supplies valid
ActionProof, or when `profilescribe-mcp` is configured with a protected
`PROFILESCRIBE_ACTIONPROOF_COMMAND`. A bearer token alone is not sufficient for
raw production timeline drafts.

## Anti-Spam Rules

Do not publish:

- generic crawl summaries
- source-change spam
- repeated posts with the same angle
- inflated claims
- posts whose only substance is that a source check happened
- posts that expose internal agent reasoning or prompt constraints

If the update is not grounded in concrete work, launches, writing, commits,
talks, shipped artifacts, or other meaningful professional evidence, leave a
local draft or observation instead of posting.
