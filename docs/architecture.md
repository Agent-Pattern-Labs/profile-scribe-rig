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
5. The harness ranks source and child-evidence opportunities across the approved
   source graph so a generic post request can discover an under-covered
   professional angle.
6. The harness refreshes the highest-ranked evidence URLs when it needs richer
   drafting context.
7. The harness builds a compact voice profile.
8. The harness drafts a fresh post in the user's voice.
9. The harness checks duplicate risk, provenance, and privacy before
   submission.
10. The harness stages the draft back to Profile Scribe.

## Opportunity Tournament Workflow

The `opportunity_tournament` worker path is separate from post composition:

1. ProfileScribe supplies a concrete win objective, hard budget, prior outcome
   signals, and optionally a compact evidence snapshot and public candidates.
2. If no snapshot is supplied, the rig reads profile, source, source-evidence,
   and timeline context through read-only ProfileScribe MCP tools. Source,
   observation, and extract records enter the grounding catalog only when their
   source ID is explicitly `approved`; profile/user facts remain eligible.
   Source metadata alone is not evidence: a source record enters the model
   catalog only when persisted crawl evidence exists for that approved source.
   The tournament loader never issues a direct GET to source URLs, follows
   source redirects, or uses the general source-extract fetcher.
   Exact structured timeline authors and people in approved source evidence can
   become candidates, with an internal ProfileScribe profile URL when an author
   slug exists. The generator call may return up to eight named person or
   organization candidates, but deterministic validation retains one only when
   its name and optional fields occur exactly in its approved evidence, its URL
   is already present there, it is not the profile owner, and its evidence
   overlaps an evaluated hypothesis. Accepted exact named candidates are marked
   identity-resolved for the tournament chain; this denotes a resolved
   evidence tuple, not People Data Labs or another provider's verification.
3. A bounded two-stage OpenRouter route, with prompt/completion/request price
   ceilings shared under one hard tournament budget, first uses
   `opportunity_tournament_commercial_v2` to return the strongest two
   `revenue_family_bundle_v2` acquisition-mode families. Each family
   contains one canonical revenue path, compact strategy dimensions, semantic
   score inputs, and explicit evidence bindings for
   buyer/offer/acquisition/destination/conversion/attribution; the response also
   includes one evidence-specific fallback experiment. Shared provider-schema
   definitions own structural constraints only. Local deterministic validators
   remain authoritative for revenue semantics, current evidence, attribution,
   numeric bounds, and evidence containment. When `maxLLMCalls: 2` is
   explicitly budgeted, call 2 is the mandatory independent
   `opportunity_tournament_critic_v1` comparison. If call 1 instead fails only
   the deterministic family-shape gate, call 2 may be consumed by one
   price-capped full-response repair; in that case the critic cannot run and no
   winner is accepted. Both calls share the same hard spend cap and evidence
   boundary. Length-finished output remains incomplete; safe generation IDs
   and provider error type/code diagnostics are retained without persisting
   partial content.
4. Deterministic code expands at most 10,000 combinations, requires each
   family's declared acquisition mode to match its
   `incremental_revenue_v3` path, verifies every grounding binding against the
   evidence catalog, applies permission and anti-volume gates, scores every
   eligible tuple, and performs diversity selection over a bounded top pool.
5. The rig returns at most 20 attributable hypotheses, one singular winner,
   one runner-up, full commercial-evidence graph plus canonical SHA-256 hash,
   exact generator/critic call receipts and bounded critic finalist/family
   bindings, usage/cost accounting, and a mandatory human-review gate whose
   winning hypothesis ID matches rank 1. Completion requires a named candidate
   whose approved evidence overlaps the rank-one buyer-segment seed and its
   offer or proof evidence. The winner action and explanation name that exact
   candidate and cited evidence, preserving the full objective → tournament →
   hypothesis → candidate → action chain. The highest-scoring finalist with
   that complete candidate grounding is promoted to rank 1; any higher-scoring
   but unactionable finalists are removed while the remaining score order is
   preserved. Completion also requires at least two finalists so the runner-up
   is distinct. Without either invariant, the bounded research run skips with
   `needs_more_approved_evidence` and zero external side effects. A response
   that remains structurally incomplete instead returns a cause-matched
   `strategy_generation_shape_recovery`, never a false market-evidence gap.
   The returned
   `revenue_evidence_experiment_v1` keeps the existing control-plane shape but
   additively preserves `knownFact`, `buyer`, `paidOffer`,
   `acquisitionMechanism`, `conversionDestination`, `paidConversion`, and
   `attributionSignal`, plus numeric time/sample stops in plain language. These
   fields are present on generated and conservative business fallbacks; they
   are intentionally absent on provider, budget, and response-shape recovery
   experiments so technical failure cannot masquerade as a business fact.
   Empty evidence also fails forward to one bounded review step rather than a
   bare dead end.

The tournament boundary permits research and recommendation only. It contains
no People Data Labs integration, contact purchase, outreach execution,
publishable outreach copy, post submission, or provider mutation. Candidate
records contain only minimal public professional identity and opaque
contact-path references; raw contact values stay outside the rig.

## Integration Boundary

Profile Scribe should be reached through `profilescribe-mcp` by default. The
bridge forwards terminal-agent MCP calls to the hosted ProfileScribe MCP
endpoint and keeps scoped token enforcement in ProfileScribe. REST and local
checkout adapters are fallback paths for development or future integrations.
