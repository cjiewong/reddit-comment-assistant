# Verification — v0.2.0

Date: 2026-10-11.

## Automated checks

TypeScript checking and 65 tests cover:

- Endpoint validation, bounded prompts, required bilingual output fields and comment length.
- Responses and Chat Completions, JSON and streaming SSE, arbitrary UTF-8/CRLF chunk boundaries, truncated streams, and HTTP errors.
- Main post extraction, ancestor comment context, Shadow DOM traversal, textarea input events, and rejection of a stale serialized composer value even when visible text looks correct.
- Background origin validation, session-key selection, provider permission denial, and cancellation when a content port disconnects.

The package contains built scripts, settings UI, icons, manifest, license and privacy notice. No source credentials or test harnesses are packaged.

## Real Reddit adapter verification

The production content bundle was exercised through TabBridge on a real, logged-in modern Reddit post. Its model-message transport was replaced with a deterministic fixture; no paid model request was made and no comment was submitted.

Verified:

- Main composer opens from the inline Generate button.
- A two-paragraph comment is inserted exactly, with two paragraphs in Reddit's public serialized composer value.
- The same behavior works in an expanded comment reply, with the correct parent context and no changes to the main editor.
- Single line breaks and paragraph breaks survive insertion and serialized-state validation.
- Existing drafts and changes made during generation are preserved.
- Cancellation preserves editor text; undo returns the editor to its previous empty state.
- Switching focus between composers preserves replacement behavior.
- Chinese explanation remains in the assistant UI and is not inserted into Reddit.

The tests exposed and fixed duplicated blank paragraphs from plain-text paste and stale Lexical selection after focus changes. Temporary test text was removed after verification.

## Settings UI

The built settings page was inspected at 760px and 390px widths in Chrome using a local UI-only extension API fixture. Neither layout had horizontal overflow. Saving configuration and clearing the fixture key were exercised. This checks UI behavior, not Chrome's actual extension permission prompt.

## Remaining integration check

A fully installed extension with a real provider API key has not been exercised in this environment. The current browser automation channel cannot load an unpacked extension through `chrome://extensions`, and no provider credential was supplied for this extension. After installation, configure your provider and generate one draft to verify your provider/model combination. These limitations are not represented as completed tests.

The v0.1.1 patch aligns the build and test tooling on esbuild 0.28 so clean installations also resolve under the npm version bundled with Node.js 22 in GitHub Actions.

## v0.1.2 gateway URL regression

The previous bare-origin URL builder generated `//responses`, which an inspected compatible gateway routed to its HTML frontend (HTTP 200). The canonical `/v1/responses` route returned an API JSON authentication error without credentials. The probe sent no key or Reddit content.

Regression coverage includes bare origins, trailing slashes, custom prefixes, full endpoints, protocol mismatches, HTML responses with misleading content types, malformed SSE data, and a real local HTTP gateway round trip whose frontend fallback serves HTML. Authenticated generation against the user's provider was not attempted.

## v0.2.0 model discovery, effort and translation

Additional tests cover model endpoint derivation, authenticated list requests, sorting/deduplication, invalid or empty lists, errors, stale-fetch cancellation, selection/persistence, default effort omission and protocol-specific effort fields, translation parsing/routing, size limits, explicit-click-only behavior, comment isolation, plain-text rendering and cancellation.

The built settings page fetched models from a real local HTTP fixture in Chrome at 760px and 390px, selected a returned model, saved effort, and showed no horizontal overflow. The production translation module was tested on a real Reddit post and an expanded comment with a deterministic model transport: zero requests at mount, one request per clicked translation button, separate source text and visible translations, and an unchanged empty reply editor. No paid translation or private provider catalog was requested during verification.
