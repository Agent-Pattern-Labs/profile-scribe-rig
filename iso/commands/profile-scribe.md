---
description: Profile Scribe post composer -- crawl URLs, search history, model voice, draft, and submit
user_invocable: true
args: mode
targets:
  claude: skip
  cursor: skip
  codex: skip
---

# profile-scribe -- Router

## Mode Routing

Determine the mode from the underlying intent in `{{mode}}`, not from exact
phrases alone. The literal mode names below are fast paths, but any clear
paraphrase should route to the same workflow.

| Input | Mode |
| --- | --- |
| empty | `discovery` |
| request to create, write, draft, prepare, share, or publish a professional update; topic, draft, prompt, or URLs with no sub-command | `compose` |
| `compose` | `compose` |
| request to inspect, fetch, scan, check, crawl, or summarize supplied URLs or approved sources without drafting | `crawl` |
| request to inspect previous posts, avoid repetition, compare history, or find prior coverage | `history` |
| request about voice, tone, style, phrasing, or how the user usually writes | `voice` |
| request to stage, submit, publish to ProfileScribe, or cross-post through ProfileScribe distribution | `submit` |
| `crawl` | `crawl` |
| `history` | `history` |
| `voice` | `voice` |
| `submit` | `submit` |

If input is not a known sub-command and includes `http://` or `https://`, route
to `compose` when the user wants a post and to `crawl` when they only want
inspection or extraction. If multiple intents are present, choose the workflow
that completes the requested end state; for example, a request to write a post
and cross-post it should use `compose` through submission/distribution rather
than stopping at `submit`.

## Discovery

Show this menu:

```text
profile-scribe -- Command Center

Commands:
  /profile-scribe {topic or URLs}  -> crawl + history + voice + draft + submit
  /profile-scribe compose          -> run the full post creation workflow
  /profile-scribe crawl            -> crawl and extract supplied URLs only
  /profile-scribe history          -> search previous posts and duplicates
  /profile-scribe voice            -> build or refresh the voice profile
  /profile-scribe submit           -> stage an approved draft in Profile Scribe
```

## Context Loading

Read `modes/_shared.md` plus exactly one active mode file:

- `modes/compose.md`
- `modes/crawl.md`
- `modes/history.md`
- `modes/voice.md`
- `modes/submit.md`

Read `modes/reference-profile-scribe.md` only when config, API, filesystem, or
submission details are the blocker.
