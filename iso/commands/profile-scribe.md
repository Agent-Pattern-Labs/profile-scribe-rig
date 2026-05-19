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

Determine the mode from `{{mode}}`:

| Input | Mode |
| --- | --- |
| empty | `discovery` |
| topic, draft, prompt, or URLs with no sub-command | `compose` |
| `compose` | `compose` |
| `crawl` | `crawl` |
| `history` | `history` |
| `voice` | `voice` |
| `submit` | `submit` |

If input is not a known sub-command and includes `http://` or `https://`, route
to `compose`. If it asks only to inspect sources, route to `crawl`.

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
