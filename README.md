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
export PROFILESCRIBE_RIG_OPENROUTER_MODEL=deepseek/deepseek-v4-pro
export PROFILESCRIBE_RIG_DRAFT_MODEL=anthropic/claude-opus-4.8
export PROFILESCRIBE_RIG_TOURNAMENT_MODEL=openai/gpt-4.1-mini
export PROFILESCRIBE_RIG_DRAFTER_COMMAND='your-drafter-command'
export PROFILESCRIBE_RIG_REWRITE_COMMAND='your-rewrite-command'
export PROFILESCRIBE_RIG_CHAT_COMMAND='your-agent-chat-command'
export PROFILESCRIBE_RIG_INTERVIEW_COMMAND='your-interview-command'
```

When OpenRouter is configured and no custom command is present, the rig fetches
short approved-source and child-evidence extracts, builds a pre-draft timeline
brief from recent posts and timeline search, ranks source and evidence
opportunities across the approved source graph, and asks
`PROFILESCRIBE_RIG_DRAFT_MODEL` for conservative source-backed post copy that
discovers an under-covered angle while avoiding repeated sources, claims,
topics, and openings. `PROFILESCRIBE_RIG_OPENROUTER_MODEL` continues to cover
non-draft native OpenRouter tasks such as interview turns.
Without OpenRouter, a drafter command, or a
`payload.body`, scheduled post jobs skip unless the worker explicitly enables
the hosted fallback generator.

Additional managed job kinds:

- `opportunity_tournament` accepts a concrete win objective, hard budget,
  optional evidence snapshot, prior outcomes, and already discovered public
  candidates. It can also preserve exact candidates already present in
  ProfileScribe timeline-author and approved structured source-evidence fields;
  it does not run a discovery provider. The same bounded model call may extract
  named person or organization candidates only when their names, optional
  details, public URLs, and evidence references are copied exactly from the
  supplied catalog; deterministic validation rejects inventions and the
  profile owner. Only source records, observations, and extracts tied to an
  explicitly `approved` source ID may ground the tournament. One bounded,
  provider-price-capped OpenRouter call generates evidence-referenced strategy
  dimensions, semantic score inputs, and those optional exact candidates.
  When the caller explicitly budgets `maxLLMCalls: 2` and that response fails
  only the deterministic family-shape gate, one further price-capped call may
  repair the full strict response; it cannot widen evidence or authority.
  The strict `revenue_family_bundle_v2` seed contract organizes each family by
  one acquisition mode rather than by profession. It requires each family to
  identify an actual buyer, explicitly paid offer, acquisition mechanism,
  separate conversion destination, paid conversion, observable revenue event,
  durable attribution signal, and exact evidence bindings for every part.
  Evidence-grounded inbound paths receive a small preference; warm, partner,
  existing-customer, and permissioned alternatives remain eligible.
  Deterministic code then expands and judges at most 10,000 tuples, retains at
  most 20 finalists, and returns one review-required winner plus a runner-up.
  For an inbound strategy only, an approved observation of the owner's public
  offer, pricing, signup, demo, application, licensing, sponsorship-inquiry,
  storefront, product, service, booking, download, marketplace-listing,
  checkout, or purchase page may serve as the
  execution asset when it is current and recently observed, positively names a
  paid, billable, purchasable, or reimbursable offer plus a conversion action,
  and its exact origin (including port and controlled path) matches the website
  or booking URL declared on the profile. Free, negated, unavailable, expired,
  inactive, or stale assets are rejected. An inbound family must also name an
  incremental discovery/demand origin—such as organic/local search, an owned
  app store, comparison/search listing, opted-in audience, earned
  directory/media discovery, marketplace or community, platform/social
  distribution, or agent-mediated discovery—and route it to a separate
  conversion destination. A pricing, signup, booking, storefront, service, or
  checkout page is a
  destination, not an acquisition mechanism. The same strategy must remain
  grounded in a buyer, paid conversion, revenue outcome, and attribution path.
  Approval alone does not make an insurer, hospital, directory, partner, or
  article page owner-controlled. The owned asset is never treated as an
  outside lead and never goes through PDL.
  Warm-referral, permissioned-outreach, partner-channel, and existing-customer
  strategies still require the exact named outside person or organization.
  Operations-only work, including eligibility, scheduling, workflow, profile,
  content, or research tasks, cannot be the singular opportunity even when it
  is useful supporting context. A completed finalist carries
  `incremental_revenue_v2`, positive expected incremental gross income, and
  evidence-linked buyer, offer, acquisition, destination, conversion, outcome,
  and attribution fields. In addition to bookings, sales, contracts,
  subscriptions, and reimbursements, the v2 contract represents
  license/royalty income, commissions/referral fees, sponsorships, platform
  payouts, and compensated roles with matching durable attribution records.
  Direct receipt metadata includes `hypotheses`, `candidates`, `winner`,
  `runnerUp`, `searchSpace`, `gate`, and `usage` for the ProfileScribe worker.
  `searchSpace` records `incremental_income_v2`, the revenue-path contract, and
  stable deterministic rejection counts/reasons so the control plane can
  validate the gate independently.
  A completed result requires an unbroken objective → tournament → hypothesis
  → exact outside target or approved owned inbound asset → reviewable action
  chain. Target evidence must overlap the winning buyer-segment seed plus its
  offer or proof evidence—not merely an unrelated citation. The internal
  recommendation names that target and one or two cited evidence labels. If
  the original score leader has no qualifying target, the highest-scoring
  grounded finalist becomes rank 1; higher ungrounded finalists are dropped so
  the score order and distinct runner-up contract remain valid. For
  model-extracted outside candidates, “resolved” means the named
  person/organization and optional public fields passed exact approved-evidence
  validation; it does not claim third-party verification. If no winner can be
  defended after the bounded generation and optional shape repair, the job returns one
  `revenue_evidence_experiment_v1` instead of a bare dead end. That experiment
  uses the same bounded model call to name a known fact or owned asset, one
  buyer, paid offer, singular acquisition test, separate destination,
  attributable paid success signal, and numeric time/sample stop in
  user-readable language. The existing v1 result now preserves those facts as
  additive `knownFact`, `buyer`, `paidOffer`, `acquisitionMechanism`,
  `conversionDestination`, `paidConversion`, and `attributionSignal` fields,
  so the control plane does not have to reconstruct them from prose. Internal
  validator or source-approval jargon is not exposed. When model output cannot
  safely ground that experiment, the rig
  returns a conservative asset- or fact-specific review step instead of
  inventing demand. ProfileScribe records the experiment outcome, links the
  single rerun to its origin, preserves the objective, and supplies the outcome
  to the next judging pass. Provider failures instead return one provider-health
  and strict-structured-output recovery with exactly one retry; budget failures
  preserve the evidence and existing cap and return one budget-compatible route
  check with exactly one retry. Neither technical recovery is mislabeled as a
  business evidence experiment, and technical recoveries intentionally omit the
  seven business-only fields. An incomplete response that cannot use or
  survive its explicitly budgeted repair returns
  `strategy_generation_shape_recovery`; it is not mislabeled as missing market
  evidence. Tournament generation uses a compact strict schema, one semantic
  score per complete strategy family, deterministic sampling, and response
  healing within at most two metered model calls under the same hard budget.
  Every experiment authorizes no execution.
  Tournament context uses only persisted profile,
  timeline, and approved crawl evidence returned by scoped read-only
  ProfileScribe tools. It never fetches a source URL directly—even when that
  source is marked approved. This job never calls People Data Labs, sends
  outreach, publishes content, or performs provider writes.
- `rewrite_latest_post` uses the latest ProfileScribe timeline post, mobile
  review feedback such as `rewriteNote` / `rewriteFeedbackReceiptId`, approved
  source evidence, and prior timeline context to submit a narrower replacement
  through `create_source_backed_timeline_post`. `source_activity_check` jobs with
  `mobileLatestPostRewrite`, `rewritePostId`, `rewriteFeedbackReceiptId`, or
  `rewriteNote` route through the same executor.
- `agent_avatar_chat`, `continue_agent_chat`, and targeted
  `continue_hosted_agent_chat` jobs resolve a peer chat, read the conversation
  with `read_agent_chat`, draft a scoped agent-avatar reply through
  `PROFILESCRIBE_RIG_CHAT_COMMAND` or OpenRouter, and send it through
  `send_agent_chat_message`.

Every `run-job` receipt includes `metadata.trace` with the job kind, duration,
MCP tools used, workflow steps, and any handoff recommendation. ProfileScribe
still owns permissions, storage, ActionProof, distribution queues, receipts, and
provider execution.

Opportunity tournaments are also research-only when the input includes public
candidate records: the rig keeps only minimal professional identity, public
URLs, opaque contact-path references, and availability flags. It does not
accept or return raw email addresses or phone numbers. Starting a tournament
does not authorize its recommended action.

OpenRouter-backed runs also retain provider, model, outcome, token, and cost
accounting metadata when drafting is skipped or a later MCP step fails. Failure
receipts intentionally exclude authorization values and generation prompts.

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
