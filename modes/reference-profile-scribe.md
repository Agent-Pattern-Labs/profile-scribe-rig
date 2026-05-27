# Profile Scribe Integration Reference

Load this reference only when setup, local filesystem integration, API
integration, or submission details are blocking the active mode.

## Supported Integration Shapes

The harness should support these integration styles, in priority order:

1. ProfileScribe MCP bridge
   - command: `profilescribe-mcp`
   - public repo: `github.com/razroo/profilescribe-mcp`
   - local reference repo: `/Users/charlie/AgentPatternLabs/profilescribe-mcp`
   - configured by `PROFILESCRIBE_AGENT_TOKEN` and `PROFILESCRIBE_MCP_URL`
   - default hosted endpoint: `https://profilescribe.com/api/mcp`

2. Local checkout
   - configured by `PROFILE_SCRIBE_ROOT` or `config.profileScribe.root`
   - used for local data access, scripts, or database adapters
   - must not assume a personal path

3. API
   - configured by `PROFILE_SCRIBE_API_URL`
   - authenticated through the environment variable named by
     `config.profileScribe.apiTokenEnv`
   - used for post retrieval and draft submission

## MCP Setup

Install the bridge:

```bash
go install github.com/razroo/profilescribe-mcp/cmd/profilescribe-mcp@latest
```

Create a scoped token from ProfileScribe's `/agents` page and export it:

```bash
export PROFILESCRIBE_AGENT_TOKEN=psagt_...
export PROFILESCRIBE_MCP_URL=https://profilescribe.com/api/mcp
```

Minimum useful scopes for this harness:

- `mcp:tools`
- `read:profile`
- `read:sources`
- `observe:sources`
- `write:drafts`

Add `read:timeline` and `interact:timeline` only when the workflow will search,
like, or comment on adjacent timeline posts.

Add `write:sources` only when the workflow will add, update, or remove approved
sources at the user's explicit request.

## Required Capabilities

Before implementing a Profile Scribe adapter, identify how to:

- list prior posts
- search prior posts by text, tag, entity, or date
- create a draft post
- update a draft post
- publish only when explicitly requested
- return a stable receipt or URL

## Posting Tool Choice

- Use `create_first_post_from_sources` only to bootstrap the profile's first
  source-backed timeline post.
- Use `create_source_backed_timeline_post` for normal follow-up posts grounded
  in approved ProfileScribe sources. Prefer the harness-authored path: pass
  final `body`, `abstracts`, topic, tone, and selected source IDs so
  ProfileScribe verifies and publishes the supplied copy.
- Use raw `create_timeline_draft` only when the runtime already provides a
  valid ActionProof envelope or `PROFILESCRIBE_ACTIONPROOF_COMMAND` is
  configured in a protected runtime.
- Do not use any posting tool for generic crawl summaries, source-change spam,
  repeated angles, or inflated claims.

## Source Tool Choice

- Use `read_sources` before any source-management action.
- Use `add_source`, `update_source`, or `remove_source` only for explicit
  source-management requests.
- For `remove_source`, prefer the exact source ID from `read_sources`; ask for
  clarification when multiple sources match the user's request.

## Missing Integration Behavior

If the configured Profile Scribe root or API does not expose the needed
capability, fail clearly with:

- missing capability
- config source checked
- exact environment variable or config key needed
- whether the draft was saved locally
