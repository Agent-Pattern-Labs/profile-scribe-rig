# Shared Profile Scribe Rules

## Data Boundary

The harness package owns instructions, modes, templates, and helper CLIs. The
consumer project owns private inputs and outputs:

- `config/profile-scribe.json`
- `data/request.md`
- `data/crawls/`
- `data/prior-posts/`
- `data/voice-profile.json`
- `data/drafts/`
- `reports/`

Do not commit private consumer data to this harness package.

## Draft Quality

- The post must be new, not a warmed-over prior post.
- The user's voice should come from style signals: sentence length, cadence,
  favorite structures, level of directness, vocabulary, and formatting habits.
- Prior posts are not a source to copy. They are a calibration set.
- Claims tied to crawled URLs must be source-backed.
- Failed crawls must be visible in the audit note.
- Default submission state is draft/review.

## Provenance

Every final draft should preserve these records in consumer-local state:

- user request or prompt
- crawled source records and failures
- prior posts consulted
- voice-profile version or summary
- duplicate check result
- draft path
- Profile Scribe submission receipt when available

## Configuration Order

Resolve integration settings in this order:

1. `config/profile-scribe.json`
2. environment variables such as `PROFILE_SCRIBE_ROOT`,
   `PROFILE_SCRIBE_API_URL`, and `PROFILE_SCRIBE_API_TOKEN`
3. explicit values supplied by the user in the current request

Never assume `/Users/charlie/Razroo/profile-scribe` exists.
