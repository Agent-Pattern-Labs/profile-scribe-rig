# Profile Scribe Agent Harness Directives

This repository is an open-source agentic harness that runs as a layer on top of Profile Scribe. In the current local development environment, Profile Scribe lives at `/Users/charlie/AgentPatternLabs/profile-scribe`; for public use, treat that path as a configurable integration target rather than a hard-coded dependency.

## Construction Pattern

Use `/Users/charlie/AgentPatternLabs/Agent-Skills` as the local reference for how this harness is constructed. In particular, follow the `create-agentic-harness` skill:

- `iso/` owns the shared cross-runtime instructions, MCP config, subagent definitions, and command router.
- `modes/` owns workflow-specific operating procedures.
- `templates/` owns executable policy, contracts, states, context bundles, migrations, and redaction rules.
- `bin/` owns user-facing CLI entry points, scaffolding, and sync behavior.
- consumer projects own private data, local config, drafts, crawl results, prior posts, and generated outputs.
- the harness package must stay portable and must not contain user-private Profile Scribe data.
- a bare "create a post" request should use ProfileScribe MCP to read profile,
  approved sources, source activity, and prior timeline context before deciding
  what to publish; user-supplied URLs are optional, not required.

## Routing Standard

Route by the user's underlying intent, not by deterministic phrases or exact
sub-command strings. The named modes (`compose`, `crawl`, `history`, `voice`,
and `submit`) are fast paths for users who know them, but natural-language
requests must reach the same workflows when the intent is clear.

Examples:

- A request to write, prepare, share, draft, or create a professional update
  should route to `compose`, even when the user does not say "compose" or
  "post".
- A request to inspect, fetch, scan, summarize, or check supplied URLs or
  approved sources without drafting should route to `crawl`.
- A request to compare against prior posts, avoid repetition, find old coverage,
  or inspect publishing history should route to `history`.
- A request about tone, writing style, voice, wording patterns, or how the post
  should sound should route to `voice`.
- A request to stage, submit, publish to ProfileScribe, or cross-post through
  ProfileScribe distribution should route through `submit` or the compose flow's
  submission step as appropriate.

If an exact command and natural-language intent conflict, follow the clearer
semantic intent and ask one concise clarification only when the requested action
would mutate sources, submit content, or distribute externally and the target is
ambiguous.

## First-Class ProfileScribe Bridge

Use `/Users/charlie/AgentPatternLabs/profilescribe-mcp` as the local reference for the public ProfileScribe MCP bridge. The harness should treat `profilescribe-mcp` as the default way for terminal agents to read ProfileScribe profile/sources and submit source-backed timeline posts. Use `/Users/charlie/AgentPatternLabs/profile-scribe` as the local reference for hosted API behavior, tool semantics, ActionProof requirements, and product rules.

Do not reimplement ProfileScribe tool behavior inside this harness. Keep the split clear:

- this harness: orchestration, URL crawling, prior-post search, voice matching, post planning, and policy
- `profilescribe-mcp`: stdio MCP transport, token forwarding, and terminal client setup
- `profile-scribe`: hosted API, permissions, source-backed posting, source management, ActionProof verification, and storage

For source-management requests, agents should read ProfileScribe sources first, then use `add_source`, `update_source`, or `remove_source` only when the user explicitly asks for that change. Source removal should use the exact source ID whenever possible and should ask for clarification when the requested source is ambiguous.

## Product Mission

The harness helps a user create a fresh Profile Scribe post by doing the research and voice-matching work around the user's draft or prompt. A complete run should:

1. Accept the user's post request, draft, topic, or source URLs.
2. Crawl every URL supplied by the user and extract the content needed to support the post.
3. Search the user's previous Profile Scribe posts and relevant local history.
4. Infer and preserve the user's writing voice, tone, phrasing patterns, and posting style.
5. Generate a new post that is original, useful, and consistent with the user's voice.
6. Submit or stage the fresh post back into Profile Scribe through the configured integration.

## Revenue Opportunity Mission

For opportunity tournaments, a money-making opportunity is always possible. We
just have not found it yet. Use verified facts about the profile owner to
search the outside professional world for the nearest credible short-term path
to payment. The profile grounds the seller, offer, proof, geography, capacity,
and constraints; it does not need to already name the buyer, employer, referral
partner, hiring manager, marketplace, or live demand. Missing outside names are
unfinished hunt, not proof that no cash path exists.

Lock the cash centerpiece first from verified facts. Rank motions around that
offer. Choose the next lead only when it is complementary to that offer. A job
posting must not replace a product or service the owner is selling. Later asks
keep the same centerpiece and advance the lead. Do not invent unproven
people or demand as facts, and do not conclude that no opportunity exists.

A normal tournament has exactly two model stages. The first call generates at
least two complete causal revenue paths and may use one bounded read-only web
search. Preserve web URL citations separately and never treat model prose as an
outside fact. Paths may contain one typed target placeholder that application
code can bind only to an exact validated provider identity. Deterministic code
then validates evidence, binds targets, expands combinations, and rejects
unsupported or passive paths. The second call is an independent compact critic;
it ranks or rejects finalists and may not generate missing evidence or rewrite
an incomplete path. Do not add a separate planner or third model call. If call
one is malformed or software blocks the hunt, return technical recovery. If a
live target was source-bound or one complete finalist remains, persist that as
the review-first next opportunity even when the critic has not compared two
families. The critic is required for an immediate revenue winner, not for
saying that a found target is the next move. Never use the critic for repair,
invent missing targets or offers as facts, or report that the market has no
opportunity. A valid provider `not_found` result with no remaining speakable
target still returns cause-matched technical recovery rather than a claim that
no cash path exists.

When both planned commercial motions resolve valid exact targets, send one
complete target-bound family from each motion to the critic so current outside
evidence can overturn the planner's prior ordering. Only when one motion binds
may its two complete tactic families supply the comparison. Candidate and fact
motion IDs must stay exact; never borrow evidence or a target across motions,
and never send more than six finalists to the critic.

Every immediate recommendation must name the exact target, reachable buyer,
current paid offer, demand-creating or demand-capturing action, separate
conversion destination, payment event, attribution signal, numeric stop, and a
credible reason the revenue is incremental within 30 days. Research never
authorizes outreach, publishing, advertising, form submission, or provider
writes.

## Agent Behavior

- Treat Profile Scribe as the source of truth for posts, user history, publishing state, and post destinations.
- Prefer existing Profile Scribe APIs, database access patterns, or local integration contracts over inventing parallel storage.
- Crawl and summarize source URLs before drafting. Do not fabricate source details when a crawl fails; surface the crawl failure and proceed only with clearly available context.
- Search prior posts before drafting so the generated post avoids repetition and matches the user's established voice.
- Preserve the user's voice without copying old posts wholesale. Reuse style signals, not private or stale content.
- Draft for a normal professional reader. The public post should read like a
  concise LinkedIn-style update written by the profile owner, not like an agent
  explaining its source checks, constraints, or reasoning.
- Keep provenance, duplicate checks, and uncertainty in private notes or
  submission metadata. Do not leak phrases like "approved sources", "source
  backed", "crawl summary", "public claim", "this post should", or "recent
  timeline context" into publishable copy.
- Select the smallest source set that directly supports the public post. Do not
  attach a source merely because it is adjacent context, inspired the angle, or
  represents a broader body of work. If the post bridges two sources, the final
  body must make concrete, source-backed claims about both; otherwise narrow
  the source list or rewrite the post around the broader claim.
- Create a genuinely new post for each request. Do not simply rewrite an older post unless the user explicitly asks for a revision.
- Keep provenance available internally: track which URLs and prior posts influenced the draft so future UI or audit features can expose that context.
- When posting back to Profile Scribe, submit the harness-authored final body
  through the verified source-backed posting tool when supported. Prefer a draft
  or review state unless the user or integration explicitly requests immediate
  publishing.
- Treat the ProfileScribe timeline post as the canonical source-backed body for
  external distribution. Do not manually truncate one canonical body for every
  social platform. When a user asks to cross-post, route the final body through
  ProfileScribe's distribution tooling so the hosted app applies provider
  limits, URL counting, media requirements, delivery receipts, and per-platform
  copy fitting.
- If asked to prepare platform-specific guidance, keep it private unless the
  user asks to review it: LinkedIn should get the fullest professional point of
  view with concrete context; X, Bluesky, Threads, and Mastodon should get one
  tight complete thought that never ends mid-sentence; media-first destinations
  should be queued only when compatible public media exists. Do not add generic
  hashtags, engagement bait, or unsupported claims just to suit a platform.

## Open-Source Requirements

- Do not hard-code personal filesystem paths, credentials, account IDs, cookies, or API tokens.
- Make Profile Scribe location, credentials, crawler settings, and posting behavior configurable through documented environment variables or config files.
- Keep the harness usable by people who do not have the local `/Users/charlie/AgentPatternLabs/profile-scribe` checkout path.
- Avoid committing scraped content, private user posts, generated drafts, or local Profile Scribe data.
- Design integrations so another developer can point the harness at their own Profile Scribe instance with minimal setup.

## Quality Bar

- Add tests around crawling, prior-post retrieval, voice-profile construction, duplicate avoidance, and Profile Scribe submission boundaries.
- Mock network crawling and Profile Scribe writes in tests unless an integration test explicitly opts into real services.
- Fail clearly when required configuration is missing.
- Keep generated posts reviewable, attributable to their source context, and safe to edit before submission.
