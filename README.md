# Reddit Comment Assistant

Draft a thoughtful Reddit reply with your own AI model, fill it into the comment editor, and review a Chinese explanation before you post.

[中文说明](README.zh-CN.md) · [Privacy](PRIVACY.md) · [Contributing](CONTRIBUTING.md)

## Features

- Inline **Generate & fill** on modern Reddit post pages and expanded comment replies.
- Fetch the provider’s model list and choose a model, with manual ID entry as a fallback.
- Configurable reasoning effort, including gateway-specific values.
- Click **Translate post** or **Translate comment** for an inline translation (Simplified Chinese by default).
- OpenAI **Responses** and **Chat Completions** APIs, including configurable compatible gateways.
- English comments with a separate Chinese explanation by default; customize language, tone, length and standing instructions.
- Additional instructions per reply, cancellation, explicit replacement, copy and undo.
- Protect existing drafts and edits made while a response is generating.
- Local configuration, session-only keys by default, optional remember-on-device storage.
- English / Simplified Chinese interface selected from the browser language.
- You review and click Reddit’s Comment button. The extension never submits comments.

## Install

1. Download `reddit-comment-assistant-0.2.0.zip` from [Releases](https://github.com/cjiewong/reddit-comment-assistant/releases) and extract it into a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
3. Click the extension icon to open settings. Enter your provider’s Base URL and API key, click **Fetch models**, select a model, and choose the matching API format. Set effort if desired, then save. Grant access to the provider when prompted.
4. Open or refresh a post on `https://www.reddit.com`. Click **Generate & fill** below the main composer, or click Reddit’s **Reply** first to reveal a reply composer.
5. Read the comment and its Chinese explanation, edit as needed, and manually publish.

A paid ChatGPT subscription is not a replacement for an API credential. Your provider bills API usage according to your account. Saving settings does not make a model request.

## Configuration

| Field               | Meaning                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL            | API root, e.g. `https://api.openai.com/v1`. Bare domains automatically use `/v1`; complete endpoint URLs are also accepted when they match the selected API format. |
| API format          | Responses for the official OpenAI API; select Chat Completions if required by your compatible provider.                                                             |
| Model name          | Select an ID fetched from the provider’s `/models` endpoint, or enter one manually.                                                                                 |
| API key             | Sent only to the configured provider. Defaults to browser-session storage.                                                                                          |
| Remember key        | Persist locally across browser restarts; local storage is not encrypted and is never synced by this extension.                                                      |
| Writing preferences | Comment language, length, tone, and standing instructions. Chinese explanations remain separate.                                                                    |

Remote API endpoints require HTTPS. HTTP is supported only for `localhost` and `127.0.0.1` development endpoints. Provider redirects are rejected to avoid forwarding credentials unexpectedly. Requests time out after two minutes; a service-worker termination or provider timeout is surfaced rather than silently retried.

The provider must support the chosen API format and return the requested JSON object containing `comment` and `explanationZh`. SSE and JSON responses are both supported. Incomplete or invalid responses are never auto-filled.

## Models, effort and translation

**Fetch models** calls `GET /models` under your configured API root (for a bare domain, `/v1/models`). Full generation endpoint URLs are converted to the corresponding models endpoint. Fetching uses the API key currently entered in settings, does not require saving first, and does not send Reddit content or generate text. Editing the Base URL/key cancels an in-flight fetch and clears the displayed list. A failed refresh preserves the selected model ID.

**Reasoning effort** is optional: leave it empty to omit the parameter and use the provider’s default. Common suggestions are `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`; you can type a custom gateway value. Supported values depend on the selected model. Responses requests send `reasoning.effort`; Chat Completions send `reasoning_effort` ([official API guidance](https://developers.openai.com/api/docs/guides/reasoning)). The same effort applies to drafting and translation.

Click **Translate post** beneath a post or **Translate comment** beneath a loaded comment. Translation starts only when clicked and appears below the original text. You can cancel, hide/show, or translate again. Select the target language in settings; the default is Simplified Chinese. Translations use the selected model and do not populate the reply editor. Sources over 60,000 characters are rejected rather than silently truncated.

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
- `src/options.ts`: model discovery, configuration and key management.
- `src/translation.ts`: per-post and per-comment translation controls.

See [verification notes](docs/verification.md) for test coverage and the distinction between live Reddit adapter checks and model-provider integration.

## License

[MIT](LICENSE). Independent project; not affiliated with Reddit or OpenAI.
