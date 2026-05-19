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
npx create-profile-scribe-harness my-profile-scribe-workspace
cd my-profile-scribe-workspace
npm install
```

Then edit `config/profile-scribe.json` in the consumer project to point at the
Profile Scribe instance or API you want to use.

## Local Development

Useful commands:

```bash
npm run smoke:config
npm run sync
node bin/profile-scribe-harness.mjs help
```

The original development machine used `/Users/charlie/Razroo/profile-scribe` as
the Profile Scribe checkout. That path is intentionally not hard-coded. Use
`PROFILE_SCRIBE_ROOT`, `PROFILE_SCRIBE_API_URL`, or consumer config instead.
