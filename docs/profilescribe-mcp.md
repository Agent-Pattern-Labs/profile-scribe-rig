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
- `write:sources` for adding, updating, or removing approved sources
- `propose:profile` for review-only profile edit proposals

## Source Management Tools

Use `read_sources` before any source-management action so the agent can match
the user's request to the actual approved source record.

Use `add_source` or `update_source` only when the user explicitly asks to add or
change a source.

Use `remove_source` only when the user explicitly asks to remove, delete,
detach, or disconnect a source. Prefer the exact source ID from `read_sources`;
fall back to an exact URL or clear label/host match. If multiple sources match,
ask for clarification instead of guessing.

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
default verified posting path for concrete, meaningful updates grounded in
approved ProfileScribe sources. The harness should pass the final public `body`,
`abstracts`, `topic`, `tone`, and selected `sourceIds`; ProfileScribe verifies
the approved sources, mints hosted ActionProof, stores observations, and
publishes the supplied body. Omit `body` only when the user explicitly wants
ProfileScribe's hosted generator to draft the copy. Keep source checks,
duplicate checks, and provenance language out of the public body.

Select `sourceIds` by claim alignment. Each submitted source should support a
specific sentence or claim in the final public body. Prefer the smallest source
set that makes the post credible. Do not include broader product, project,
company, or identity sources solely because they are adjacent context; if a post
needs that source, the body should make the supported connection clear.

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
