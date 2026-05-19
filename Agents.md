# Profile Scribe Agent Harness Directives

This repository is an open-source agentic harness that runs as a layer on top of Profile Scribe. In the original local development environment, Profile Scribe lives at `/Users/charlie/Razroo/profile-scribe`; for public use, treat that path as a configurable integration target rather than a hard-coded dependency.

## Product Mission

The harness helps a user create a fresh Profile Scribe post by doing the research and voice-matching work around the user's draft or prompt. A complete run should:

1. Accept the user's post request, draft, topic, or source URLs.
2. Crawl every URL supplied by the user and extract the content needed to support the post.
3. Search the user's previous Profile Scribe posts and relevant local history.
4. Infer and preserve the user's writing voice, tone, phrasing patterns, and posting style.
5. Generate a new post that is original, useful, and consistent with the user's voice.
6. Submit or stage the fresh post back into Profile Scribe through the configured integration.

## Agent Behavior

- Treat Profile Scribe as the source of truth for posts, user history, publishing state, and post destinations.
- Prefer existing Profile Scribe APIs, database access patterns, or local integration contracts over inventing parallel storage.
- Crawl and summarize source URLs before drafting. Do not fabricate source details when a crawl fails; surface the crawl failure and proceed only with clearly available context.
- Search prior posts before drafting so the generated post avoids repetition and matches the user's established voice.
- Preserve the user's voice without copying old posts wholesale. Reuse style signals, not private or stale content.
- Create a genuinely new post for each request. Do not simply rewrite an older post unless the user explicitly asks for a revision.
- Keep provenance available internally: track which URLs and prior posts influenced the draft so future UI or audit features can expose that context.
- When posting back to Profile Scribe, prefer a draft or review state unless the user or integration explicitly requests immediate publishing.

## Open-Source Requirements

- Do not hard-code personal filesystem paths, credentials, account IDs, cookies, or API tokens.
- Make Profile Scribe location, credentials, crawler settings, and posting behavior configurable through documented environment variables or config files.
- Keep the harness usable by people who do not have the original `/Users/charlie/Razroo/profile-scribe` checkout path.
- Avoid committing scraped content, private user posts, generated drafts, or local Profile Scribe data.
- Design integrations so another developer can point the harness at their own Profile Scribe instance with minimal setup.

## Quality Bar

- Add tests around crawling, prior-post retrieval, voice-profile construction, duplicate avoidance, and Profile Scribe submission boundaries.
- Mock network crawling and Profile Scribe writes in tests unless an integration test explicitly opts into real services.
- Fail clearly when required configuration is missing.
- Keep generated posts reviewable, attributable to their source context, and safe to edit before submission.
