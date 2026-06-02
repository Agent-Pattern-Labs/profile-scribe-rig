# Profile Scribe Agent Harness

An open-source agentic harness for creating Profile Scribe posts. The harness
crawls user-provided URLs, searches previous posts, builds a lightweight voice
profile, drafts a fresh post in the user's style, and stages or submits it back
to a configured Profile Scribe instance.

This repo follows the harness construction pattern from
`/Users/charlie/AgentPatternLabs/Agent-Skills`, especially the
`create-agentic-harness` skill:

- `iso/` is the source of truth for cross-runtime agent instructions.
- `modes/` holds workflow-specific procedures.
- `templates/` holds executable policy and contracts.
- `bin/` exposes user-facing CLIs.
- consumer projects own private data and receive shared harness files through
  install or sync.

## Quick Start

```bash
npm install
npm run verify
```

Create a consumer project:

```bash
npm exec --package @agent-pattern-labs/profile-scribe-rig -- create-profile-scribe-harness my-profile-scribe-workspace
cd my-profile-scribe-workspace
npm install
```

Then edit `config/profile-scribe.json` in the consumer project to point at the
Profile Scribe instance or API you want to use.

## ProfileScribe MCP

This harness treats `profilescribe-mcp` as the first-class integration with
ProfileScribe.

Install the bridge:

```bash
go install github.com/razroo/profilescribe-mcp/cmd/profilescribe-mcp@latest
```

Create a scoped token from ProfileScribe's `/agents` page. For posting through
this harness, grant at least:

- `mcp:tools`
- `read:profile`
- `read:sources`
- `observe:sources`
- `write:drafts`

Grant `write:sources` as well when the harness should add, update, or remove
approved sources on explicit user request.

Export the token before starting your agent runtime:

```bash
export PROFILESCRIBE_AGENT_TOKEN=psagt_...
export PROFILESCRIBE_MCP_URL=https://profilescribe.com/api/mcp
```

The normal posting path is `create_source_backed_timeline_post` with the
harness-authored final `body`, `abstracts`, topic, tone, and selected source
IDs. A user can ask "create a post" without supplying URLs; the harness should
read ProfileScribe profile data, approved sources, source activity, and prior
timeline context, then decide whether there is a meaningful source-backed update
to publish. ProfileScribe verifies sources, mints hosted ActionProof, stores
observations, and publishes the supplied body. Use `create_first_post_from_sources`
only to bootstrap the first timeline post. Use raw `create_timeline_draft` only
from a protected runtime that can provide valid ActionProof.

For source-management requests, call `read_sources` first and use `add_source`,
`update_source`, or `remove_source` only when the user explicitly asks for that
change. Source removal should use the exact source ID whenever possible.

## Local Development

Useful commands:

```bash
npm run smoke:config
npm run sync
node bin/profile-scribe-harness.mjs help
profile-scribe-harness run-job --job-file ./job.json --dry-run
```

## Managed Worker Entry Point

`profile-scribe-harness run-job` is the deterministic command that hosted
workers call for one ProfileScribe managed-agent job. It reads a job JSON file,
uses ProfileScribe MCP for profile/source/timeline context, uses OpenRouter for
native post drafting and interview turns when `OPENROUTER_API_KEY` is present,
optionally calls configured drafter/interview commands, and returns a JSON
receipt for the worker to store.

Useful environment:

```bash
export PROFILESCRIBE_AGENT_TOKEN=psagt_...
export PROFILESCRIBE_MCP_URL=https://profilescribe.com/api/mcp
export OPENROUTER_API_KEY=sk-or-...
export PROFILESCRIBE_RIG_OPENROUTER_MODEL=deepseek/deepseek-v4-flash
export PROFILESCRIBE_RIG_DRAFT_MODEL=anthropic/claude-opus-4.8
export PROFILESCRIBE_RIG_DRAFTER_COMMAND='your-drafter-command'
export PROFILESCRIBE_RIG_INTERVIEW_COMMAND='your-interview-command'
```

When OpenRouter is configured and no custom command is present, the rig fetches
short approved-source extracts, builds a pre-draft timeline brief from recent
posts and timeline search, and asks `PROFILESCRIBE_RIG_DRAFT_MODEL` for
conservative source-backed post copy that avoids repeated sources, claims,
topics, and openings. `PROFILESCRIBE_RIG_OPENROUTER_MODEL`
continues to cover non-draft native OpenRouter tasks such as interview turns.
Without OpenRouter, a drafter command, or a
`payload.body`, scheduled post jobs skip unless the worker explicitly enables
the hosted fallback generator.

## Publishing

The npm package is published as
`@agent-pattern-labs/profile-scribe-rig` with public scoped access.
The GitHub Actions publish workflow expects `NPM_TOKEN` to be available to the
repo or organization.

Create a GitHub release with the GitHub CLI to publish the matching package
version to the Agent Pattern Labs npm org:

```bash
gh release create v0.1.0 --title v0.1.0 --generate-notes
```

The release must be published, not left as a draft. The workflow also supports
manual `workflow_dispatch` runs from GitHub Actions.

The local development machine uses `/Users/charlie/AgentPatternLabs/profile-scribe`
as the Profile Scribe checkout. That path is intentionally not hard-coded. Use
`PROFILE_SCRIBE_ROOT`, `PROFILE_SCRIBE_API_URL`, `PROFILESCRIBE_MCP_URL`, or
consumer config instead.
