# Project guidance

This is a Manifest V3 Chrome extension for drafting Reddit comments. Preserve manual final posting, existing editor drafts, key isolation and the separation of comment text from Chinese explanations.

Use `npm ci`, `npm run check`, `npm test` and `npm run package`. Source is TypeScript; build output belongs in ignored `dist/` and `artifacts/`. Run `npm run format` after source changes.

For browser verification, use the channel authorized by the current session. Verify both rendered text and Reddit's serialized composer value. Never publish test comments. Use synthetic fixtures in the repository and exclude credentials, account captures, and personal working files.

Keep README.md, README.zh-CN.md and PRIVACY.md aligned with user-visible behavior. Report real-provider and installed-extension testing separately from mocked transport checks.
