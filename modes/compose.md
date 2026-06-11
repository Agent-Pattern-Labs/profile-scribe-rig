# Compose Mode

Use this mode for the full Profile Scribe post creation workflow.

## Inputs

- User topic, rough draft, note, or instruction, if supplied.
- Any supplied URLs, if supplied.
- Consumer Profile Scribe config.
- ProfileScribe profile, approved sources, source activity, and prior posts from
  ProfileScribe MCP.

## Procedure

1. Resolve ProfileScribe MCP configuration. If `profilescribe-mcp` or
   `PROFILESCRIBE_AGENT_TOKEN` is missing, stop with exact setup instructions.
2. Call `read_profile` and `read_sources` before deciding what to post.
3. Extract every URL from the request. Crawl each URL through `crawl` mode
   behavior before drafting. Preserve failures — do not silently drop a URL or
   invent source details for failed crawls.
4. If the request does not include URLs, inspect approved sources and recent
   source state:
   - use source checkpoint/observation/fact-candidate tools when available
   - build a pre-draft timeline brief from timeline search/discovery when
     available
   - rank source and child-evidence opportunities across the approved source
     graph, preferring professionally relevant articles, repositories, recently
     changed evidence, under-covered sources, explicit topic matches, and source
     pairs that create a concrete new professional angle
   - choose a specific source-backed update or stop with "no post-worthy update"
5. Search prior posts using `history` mode behavior. Record related posts,
   timeline direction, covered sources, repeated openings, repeated topics, and
   angles to avoid. Record the ranked source opportunities that were inspected.
6. Build or refresh the voice profile using `voice` mode behavior.
7. Draft a new post with:
    - a default source-backed professional update when the user does not request
      a specific format
    - one clear point of view
    - source-backed facts that name specific projects, repositories, articles,
      launches, talks, or shipped work — avoid vague references to "current
      direction", "recent updates", or "the work"
    - source selection that matches the actual public claim, not the broader
      research context
    - a concrete work signal: what changed, shipped, was written, released,
      updated, learned, or became clearer
    - why the signal matters for the profile owner's current professional
      direction
    - a substantive first-person reflection, decision, tradeoff, or pattern
      noticed — not a generic observation anyone could write. The reflection
      must tie directly to the specific work signal, not be a standalone
      aphorism or platitude about "the importance of X".
    - the user's observed voice
    - no heavy copying from prior posts
    - normal first-person professional wording suitable for a LinkedIn feed
    - no visible planning language, prompt constraints, crawl narration, or
      provenance/audit labels in the public body
    - a materially new angle when using a source that appeared recently
    - autonomous professional discovery: the agent should choose the strongest
      under-covered source-backed opportunity itself when the user gives only a
      generic "create a post" request
    - a canonical body that can stand on its own in ProfileScribe; external
      destinations should be adapted later by ProfileScribe's distribution
      adapter, not by chopping this body down in the harness
8. Make the post descriptive and specific enough that a reader understands
   exactly what the post is about without clicking any links:
   - Name the specific project, repository, article, tool, or launch by name
   - Say what was built, changed, shipped, or learned — not just that "work is
     progressing"
   - Include concrete technical or professional detail that shows real effort
     and genuine expertise
   - Explain why this specific thing matters for your audience or your own work
   - Use specific numbers, versions, features, or outcomes when the source
     supports them
   - 2-4 substantive paragraphs minimum; a single short sentence is almost
     never enough
   - Avoid hand-wavy framing like "current direction", "in-progress markers",
     "the pattern is easier to see", "concrete change", or "making work
     inspectable" — these meta-commentaries say nothing about the actual work
9. Run checks:
   - all crawled claims have provenance
   - duplicate risk is acceptable or called out before submission
   - same-source posts do not repeat the same claims, story shape, title, or
     opening
   - each selected source ID directly supports at least one sentence or claim in
     the final public body
   - no source is included only as adjacent background, inspiration, or a loose
     bridge to a broader body of work
   - voice does not drift into generic assistant prose
   - the draft reads like the profile owner wrote it for people, not like an
     agent thinking out loud
   - the public body does not contain phrases such as "approved sources",
     "source-backed", "crawl summary", "public claim", "this post should", or
     "timeline context"
   - private tokens, cookies, and raw credentials are absent
   - private agent commentary about what the post is doing, how it was derived,
     or why it was written must not appear in the public body
10. Prepare platform-specific guidance for cross-posting. Keep this private
    unless the user asks to review it:
    - **LinkedIn:** use the full canonical body as-is. LinkedIn supports long-
      form professional updates and the full detail works best here. Lead with
      the concrete work signal, not a generic greeting or framing statement.
    - **X, Bluesky, Threads, Mastodon:** produce one tight complete thought
      (280-500 chars depending on platform) that captures the single most
      interesting claim from the post. Structure: concrete claim → one
      supporting detail → implication or takeaway. The short variant must
      stand alone as a complete, self-contained update — not end mid-sentence
      or trail off with an ellipsis. Omit the reflection paragraph and keep
      only the concrete work signal. Do not add generic hashtags, engagement
      bait, or unsupported claims. Prefer platform-native short-form wording
      over truncating the canonical body.
    - **WordPress, Ghost, Medium:** use the full canonical body with optional
      title/headline. Add a brief introductory sentence if the body assumes
      LinkedIn-native context that does not carry over to a blog post.
    - **Google Business Profile, Facebook, Instagram:** only queue when
      compatible public media exists. Use a tight 1-2 sentence summary that
      names the specific project and outcome, then points to the full post at
      ProfileScribe.
    - Route all platform variants through ProfileScribe's distribution queue
      so the hosted app applies provider limits, URL counting, delivery
      receipts, and per-platform fitting. Never submit a half-sentence or
      ellipsis-truncated social variant from the harness.
11. For normal autonomous posting, call `create_source_backed_timeline_post`
    with the chosen topic, final draft `body`, `abstracts`, tone, and minimal
    source IDs that directly substantiate the final body. The harness owns the
    final public copy. ProfileScribe owns approved-source verification, hosted
    ActionProof, storage, and publication. If the active ProfileScribe
    integration does not support `body`/`abstracts` on
    `create_source_backed_timeline_post`, stop and report that the integration
    is too old rather than falling back to hosted copy generation.
12. If no specific, meaningful update exists, do not post. Return the source
    checks performed, ranked opportunities inspected, and the reason no post was
    created.

## Default Post Type

When the user does not request a specific format, draft a substantive
first-person professional update grounded in visible evidence. The post should
help a normal professional reader understand exactly what the profile owner
built, shipped, learned, wrote, or changed — naming specific projects,
repositories, articles, or outcomes rather than speaking in generalities about
"current direction" or "making work visible".

A substantive post connects three things:
1. A specific work signal (shipped X, learned Y, decided Z)
2. The context or problem that made that signal meaningful
3. What the profile owner now knows, can do, or believes differently

Missing any of these three, the post reads as either vague promotion or
unmotivated detail. Aim for 2-4 paragraphs that cover all three. A single
vague sentence is a sign the evidence is too thin for a post.

Do not default to promotional launch copy, generic thought leadership,
engagement bait, or summaries of crawler/source activity. Use launch framing
only when the source context actually supports a launch.

Avoid posts that are only about the profile owner's tools, frameworks, or
tech stack without connecting them to a specific professional outcome. "We
switched to X" is not a post unless the switch solved a concrete problem that
the reader would recognize.

## Output

Return:

- draft text
- source summary
- source opportunity summary
- prior-post/timeline-direction/voice summary
- duplicate risk
- submission status or next action
