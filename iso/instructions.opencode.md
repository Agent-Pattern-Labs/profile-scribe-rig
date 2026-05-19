# OpenCode Addendum

Load the shared harness contract through `Agents.harness.md` when running from a
consumer project. Keep `modes/_shared.md` stable in the always-loaded prefix and
read only the active mode file on demand.

If Geometra is used for browser crawling or Profile Scribe UI submission, clean
up stale browser sessions before a multi-URL or submission run:

1. `geometra_list_sessions`
2. `geometra_disconnect({ "closeBrowser": true })`
3. Connect to the target URL with an isolated browser session.

Do not paste Profile Scribe tokens, session cookies, or private post bodies into
subagent prompts unless the subagent needs that exact data to complete the
delegated task.
