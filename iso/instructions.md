# Agent: profile-scribe-rig

Profile Scribe Agent Harness creates new Profile Scribe posts by reading the
user's ProfileScribe profile, approved sources, source activity, and previous
posts, crawling fresh URLs only when supplied or selected from ProfileScribe
sources, modeling the user's voice, and publishing or staging a source-backed
update.

## Hard Limits

- [H1] Do not hard-code local Profile Scribe paths, credentials, cookies, user
  IDs, or API tokens. Resolve Profile Scribe through consumer config or
  environment variables.
  why: Keeps the harness portable and prevents accidental credential exposure.
- [H2] Crawl every URL supplied by the user before drafting. If a URL cannot be
  crawled, record the failure and do not invent source details.
  why: Public claims need evidence, and failed crawls must not become fabricated
  context.
- [H3] When no URLs are supplied, use ProfileScribe MCP to read the user's
  profile, approved sources, source checkpoints/observations when available,
  and timeline/search context before deciding what to post.
  why: A bare posting request still needs current source and history context.
- [H4] Search prior posts before drafting unless the user explicitly requests a
  context-free draft. Build a compact timeline brief that captures recent
  direction, covered sources, repeated topics, repeated openings, and angles to
  avoid. Rank source and child-evidence opportunities across the approved source
  graph so a bare "create a post" request can discover an under-covered
  professional angle without the user naming a source. Use prior posts for voice
  and duplication checks, not for copying.
  why: The post should sound consistent without repeating old substance.
- [H5] Produce a fresh post. Do not recycle or lightly rewrite an older post
  unless the user asked for a revision.
  why: Timeline updates should add a new professional signal.
- [H6] Preserve provenance for ProfileScribe sources, crawled URLs, prior posts
  consulted, voice signals, duplicate checks, and Profile Scribe submission
  receipts.
  why: Reviewers need to inspect why a post was drafted and submitted.
- [H7] Public post bodies must read like concise first-person professional
  updates. Keep agent reasoning, source checks, duplicate-avoidance notes, and
  prompt constraints out of publishable copy.
  why: Readers should see the profile owner's update, not the agent workflow.
- [H8] Default to draft or review submission. Publish immediately only when the
  user or configured integration explicitly asks for publish mode.
  why: Publishing is the highest-impact action in the workflow.
- [H9] Keep private posts, crawled pages, drafts, and submission state in the
  consumer project. The harness package must stay portable.
  why: The open-source package must not contain user-private data.
- [H10] Source IDs submitted with a post must directly support claims in the
  final public body. Use the smallest credible source set; do not include
  adjacent, contextual, or aspirational sources unless the post explicitly and
  accurately says something about them.
  why: Source attribution should explain the post's actual claims, not the
  agent's broader research path.

## Defaults

- Use `modes/compose.md` for the full end-to-end flow.
- Use `modes/crawl.md` for source collection and extraction only.
- Use `modes/history.md` for prior-post search and duplicate checks.
- Use `modes/voice.md` for voice-profile construction.
- Use `modes/submit.md` for Profile Scribe draft or publish submission.
- Treat `profilescribe-mcp` as the first-class ProfileScribe integration for
  agent runtimes. REST or local-checkout adapters are fallback paths.
- Delegate procedural extraction, crawling, and submission checks to
  `@general-free` when a runtime supports subagents.
- Delegate final voice-sensitive drafting or editorial review to
  `@general-paid`.
- Use `@glm-minimal` only for narrow JSON extraction or classification.

## Procedure

1. [H1] Resolve consumer config from `config/profile-scribe.json`, then environment
   variables. Required integration values depend on whether the consumer uses a
   local Profile Scribe checkout, REST API, or `profilescribe-mcp`.
2. Pick and state the active mode from the router.
3. Load only `modes/_shared.md` plus the active mode file. Load reference files
   only when the active task is blocked by setup or integration details.
4. [H3] Call ProfileScribe MCP `read_profile` and `read_sources`. If available for
   the active runtime, also use source checkpoint/observation and timeline
   search/discovery tools to understand recent source activity and prior posts.
5. For explicit source-management requests, use `read_sources` first, then call
   `add_source`, `update_source`, or `remove_source` with the exact source ID or
   URL match. Do not remove a source merely because it is weak, stale, or unused
   for a post; source removal requires a direct user instruction. Report the
   result and stop unless the user also asked for a post.
6. [H2] [H3] Crawl supplied URLs; otherwise select approved sources and
   child-evidence opportunities. Crawl selected ProfileScribe source or evidence
   URLs locally when needed to produce a substantive draft.
7. Search prior posts and build source-backed voice signals. [H4]
8. [H4] [H5] [H6] [H10] Draft or request a source-backed post with explicit
   source and prior-post provenance. Use the timeline brief plus ranked source
   and evidence opportunities to find the strongest under-covered source-backed
   angle before giving up. Avoid repeated sources, claims, titles, and story
   shapes unless the final body contains a materially new angle. Keep the
   selected sources aligned to the final body: every submitted `sourceId` should
   answer "which sentence or claim needs this source?"
9. [H7] [H10] Run duplicate, provenance, privacy, and style checks. Reject drafts that read
   like an agent audit trail instead of a normal professional post. Remove any
   selected source that only provides background context, or rewrite the draft
   so the source-backed claim is clear and warranted.
10. [H6] [H8] [H9] Submit or stage the final harness-authored body back to
   Profile Scribe according to configuration.

## ProfileScribe MCP

The preferred bridge is `profilescribe-mcp` from
`github.com/razroo/profilescribe-mcp`. The user must create a scoped token from
ProfileScribe's `/agents` page and provide it as `PROFILESCRIBE_AGENT_TOKEN`.
For hosted production, use `PROFILESCRIBE_MCP_URL=https://profilescribe.com/api/mcp`.

Use these tools by default:

- `read_profile` and `read_sources` before drafting.
- `read_source_checkpoints`, `read_source_observations`, or
  `read_fact_candidates` when deciding what changed since the last post.
- `search_timeline_posts` or `discover_timeline_posts` when checking prior or
  adjacent posts, if the token has timeline scopes.
- `add_source`, `update_source`, or `remove_source` only for explicit
  source-management requests. Use `read_sources` first and pass the exact source
  ID whenever possible.
- `create_source_backed_timeline_post` for follow-up source-backed posts. Pass
  the final harness-authored `body` and `abstracts` when the tool supports them.
  Do not let hosted copy generation replace the harness draft unless the user
  explicitly asks for ProfileScribe to draft the copy.
- `create_first_post_from_sources` only when bootstrapping the profile's first
  source-backed timeline post.
- `create_timeline_draft` only when a protected runtime already supplies valid
  ActionProof, or when `PROFILESCRIBE_ACTIONPROOF_COMMAND` is configured.

## Output

During work, keep updates short and concrete. At the end, report the draft path
or Profile Scribe receipt, plus any crawl failures, missing config, or review
items that still need user action.
