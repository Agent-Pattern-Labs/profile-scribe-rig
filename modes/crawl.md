# Crawl Mode

Use this mode to fetch and extract content from supplied URLs.

## Procedure

1. Parse every URL from the request. Keep original URL and normalized URL.
2. Fetch each URL with the configured crawler.
3. Extract title, author, date, canonical URL, visible text summary, and key
   facts relevant to the requested post.
4. Store source records in consumer-local state when a writable consumer project
   is available.
5. For failures, record URL, error type, status code if available, and retry
   guidance.

## Rules

- Do not silently drop a URL.
- Do not invent title, author, date, or claims.
- Prefer structured page metadata when available.
- Keep summaries short enough to be used by `compose` mode.

## Output Contract

Emit one record per URL:

```json
{
  "url": "https://example.com",
  "status": "crawled",
  "title": "Example",
  "canonicalUrl": "https://example.com/",
  "summary": "Short source-backed summary.",
  "facts": [],
  "failure": null
}
```
