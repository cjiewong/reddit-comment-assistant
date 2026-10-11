# Privacy

This extension has no developer-operated backend, telemetry, advertising, or analytics.

When you click Generate, it reads the current post title, body, subreddit name, the selected reply's loaded ancestor comments, and your writing instructions. It sends that text directly to the API provider configured in settings, with your API key. The provider's own privacy and retention terms apply. Responses API requests specify `store: false`; this does not override a provider's separate retention policies.

API keys are held in `chrome.storage.session` by default. If you choose Remember key, the key is stored in `chrome.storage.local`, without application-level encryption. Both storage areas are restricted to trusted extension contexts. The extension does not sync keys and never passes them to Reddit content scripts. Clearing the key removes both stored copies. Uninstalling the extension removes its extension storage.

Writing preferences persist locally. Drafts are held in page memory, and text filled into Reddit is then handled by Reddit's editor and draft behavior. This extension never clicks Submit or calls a Reddit posting API.

The extension runs a content script only on `https://www.reddit.com/*`. API host access is optional and requested for the configured origin when you save settings. No browsing-history, cookies, debugger, or clipboard-read permissions are requested. Clicking Copy writes only the generated comment to your clipboard.

Only text relevant to the current generation is sent. Content length is capped. Model output is rendered as text; any HTML used to paste paragraphs is constructed from escaped text nodes. Page content is treated as untrusted model context.

When you click Fetch models in settings, the trusted settings page sends your entered key directly to the corresponding models endpoint. It sends no Reddit text and does not persist the key unless you subsequently save settings. The returned list is held in page memory and is cleared when the Base URL or key changes.

When you click Translate post or Translate comment, only that post’s title/body or that comment’s own text is sent with the selected model, effort and translation-language preference. No automatic translation is performed. Translations are displayed locally as safe text nodes in paragraphs, lists and code blocks and are not inserted into Reddit’s reply editor. The provider may charge for translation requests as for other model calls.
