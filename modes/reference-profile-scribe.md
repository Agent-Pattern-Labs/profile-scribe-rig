# Profile Scribe Integration Reference

Load this reference only when setup, local filesystem integration, API
integration, or submission details are blocking the active mode.

## Supported Integration Shapes

The harness should support both integration styles:

1. Local checkout
   - configured by `PROFILE_SCRIBE_ROOT` or `config.profileScribe.root`
   - used for local data access, scripts, or database adapters
   - must not assume a personal path

2. API
   - configured by `PROFILE_SCRIBE_API_URL`
   - authenticated through the environment variable named by
     `config.profileScribe.apiTokenEnv`
   - used for post retrieval and draft submission

## Required Capabilities

Before implementing a Profile Scribe adapter, identify how to:

- list prior posts
- search prior posts by text, tag, entity, or date
- create a draft post
- update a draft post
- publish only when explicitly requested
- return a stable receipt or URL

## Missing Integration Behavior

If the configured Profile Scribe root or API does not expose the needed
capability, fail clearly with:

- missing capability
- config source checked
- exact environment variable or config key needed
- whether the draft was saved locally
