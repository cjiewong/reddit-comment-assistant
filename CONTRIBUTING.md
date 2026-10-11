# Contributing

Use Node.js 22.12+ and run `npm ci`, `npm run check`, `npm test`, and `npm run package` before proposing changes. Keep fixtures synthetic and never commit API keys, account data, or raw Reddit session captures.

Editor changes need a real Chrome/Reddit check as well as DOM unit tests: verify visible text and the composer's serialized content, paragraph handling, empty undo, main comments, replies, and preservation of edits while generation runs. Do not publish test comments.

Changes to provider parsing should cover Responses and Chat Completions, SSE split across arbitrary UTF-8/CRLF boundaries, non-streaming JSON, errors, cancellation and incomplete output. Keep production dependencies minimal.

Format source with `npm run format`. Document changes to permissions and data flows in PRIVACY.md.
