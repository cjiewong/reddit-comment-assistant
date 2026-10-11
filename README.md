# Reddit Comment Assistant

Draft a thoughtful Reddit reply with your own AI model, fill it into the comment editor, and review a Chinese explanation before you post.

[中文说明](README.zh-CN.md) · [Privacy](PRIVACY.md) · [Contributing](CONTRIBUTING.md)

## Features

- Inline **Generate & fill** on modern Reddit post pages and expanded comment replies.
- OpenAI **Responses** and **Chat Completions** APIs, including configurable compatible gateways.
- English comments with a separate Chinese explanation by default; customize language, tone, length and standing instructions.
- Additional instructions per reply, cancellation, explicit replacement, copy and undo.
- Protect existing drafts and edits made while a response is generating.
- Local configuration, session-only keys by default, optional remember-on-device storage.
- English / Simplified Chinese interface selected from the browser language.
- You review and click Reddit’s Comment button. The extension never submits comments.

## Install

1. Download `reddit-comment-assistant-0.1.2.zip` from [Releases](https://github.com/cjiewong/reddit-comment-assistant/releases) and extract it into a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
3. Click the extension icon to open settings. Enter your provider’s Base URL, API key and exact model ID. Select the matching API format, then save and grant access to that provider.
4. Open or refresh a post on `https://www.reddit.com`. Click **Generate & fill** below the main composer, or click Reddit’s **Reply** first to reveal a reply composer.
5. Read the comment and its Chinese explanation, edit as needed, and manually publish.

A paid ChatGPT subscription is not a replacement for an API credential. Your provider bills API usage according to your account. Saving settings does not make a model request.

## Configuration

| Field               | Meaning                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL            | API root, e.g. `https://api.openai.com/v1`. Bare domains automatically use `/v1`; complete endpoint URLs are also accepted when they match the selected API format. |
| API format          | Responses for the official OpenAI API; select Chat Completions if required by your compatible provider.                                                             |
| Model name          | Exact model identifier supported by your provider. No model is hardcoded.                                                                                           |
| API key             | Sent only to the configured provider. Defaults to browser-session storage.                                                                                          |
| Remember key        | Persist locally across browser restarts; local storage is not encrypted and is never synced by this extension.                                                      |
| Writing preferences | Comment language, length, tone, and standing instructions. Chinese explanations remain separate.                                                                    |

Remote API endpoints require HTTPS. HTTP is supported only for `localhost` and `127.0.0.1` development endpoints. Provider redirects are rejected to avoid forwarding credentials unexpectedly. Requests time out after two minutes; a service-worker termination or provider timeout is surfaced rather than silently retried.

The provider must support the chosen API format and return the requested JSON object containing `comment` and `explanationZh`. SSE and JSON responses are both supported. Incomplete or invalid responses are never auto-filled.

## Draft behavior

An empty editor is filled automatically. An unchanged previous assistant draft may be replaced on regeneration. Other existing text is preserved: use **Replace editor text** deliberately, or **Copy comment**. **Undo fill** restores the immediately preceding text only while the inserted text is unchanged. Replacing rich text restores its text, not its original formatting.

If Reddit changes its editor and exact insertion verification fails, the generated draft stays available for copying. Only loaded post text and the target comment’s ancestor chain are used; images and videos are not interpreted. Supported site: modern `www.reddit.com` post pages. Old Reddit and automatic publishing are outside this release.

## Development

Node.js 22.12+ and npm:

```sh
npm ci
npm run check
npm test
npm run build
npm run package
```

Load `dist/` in Chrome. Reload the extension and Reddit tab after rebuilding. ZIP output is in `artifacts/`. Production builds contain no runtime dependencies or remote scripts.

- `src/background.ts`: trusted credential handling, provider permissions and request cancellation.
- `src/api.ts`: provider adapters and bounded output parsing.
- `src/reddit.ts`: context extraction and verified Lexical / textarea insertion.
- `src/content.ts`: inline UI and draft lifecycle.
- `src/options.ts`: configuration and key management.

See [verification notes](docs/verification.md) for test coverage and the distinction between live Reddit adapter checks and model-provider integration.

## License

[MIT](LICENSE). Independent project; not affiliated with Reddit or OpenAI.
