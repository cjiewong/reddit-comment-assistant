# Reddit Comment Assistant

使用自己配置的模型，为 Reddit 帖子或评论生成回复，一键填入评论框，并通过中文解释检查语义后手动发布。

[English](README.md) · [隐私说明](PRIVACY.md)

## 功能

- 新版 Reddit 帖子主评论和展开后的评论回复。
- 可配置 Base URL、API Key、模型名称，支持 Responses 与 Chat Completions 接口。
- 默认生成英语评论，另附中文解释；支持修改语言、语气、长度及长期写作要求。
- 每次评论可补充要求，支持取消、复制、明确替换和撤销填入。
- 自动保护已有草稿和等待生成时输入的内容。
- 密钥默认仅保存在浏览器会话中，可选在本机记住；插件不会自动发布评论。

## 安装

1. 从 [Releases](https://github.com/cjiewong/reddit-comment-assistant/releases) 下载 `reddit-comment-assistant-0.1.2.zip`，解压到长期保留的文件夹。
2. 打开 `chrome://extensions`，启用“开发者模式”，点击“加载已解压的扩展程序”，选择含有 `manifest.json` 的解压目录。
3. 点击扩展图标进入设置，填写接口地址、API Key 和完整模型名，选择接口类型，保存并授予该接口域名访问权限。
4. 打开或刷新 `www.reddit.com` 上的帖子。在主评论框旁点击“生成并填入”；回复他人时先点击 Reddit 的 Reply。
5. 检查英语评论与中文解释，按需修改，最后自己点击 Reddit 的 Comment 发布。

从源码构建时，加载项目的 `dist/` 目录。Chrome 更新扩展后，需要刷新 Reddit 页面。

## 模型配置

- **Base URL**：填写 API 根地址，例如 `https://api.openai.com/v1`，只填域名会自动补齐 `/v1`，也可填写与所选接口类型一致的完整 `/responses` 或 `/chat/completions` 地址。
- **接口类型**：OpenAI 官方优先用 Responses；兼容网关按提供商说明选择。切换网关时也要检查接口类型。
- **模型名称**：填写该服务实际支持的模型 ID，不预设或锁定模型。
- **API Key**：使用自己的 API 凭据。ChatGPT 订阅不等于 API 额度，调用费用由所配置的提供商计算；保存设置不会调用模型。
- **记住密钥**：未勾选时，浏览器重启、扩展更新或重新加载会清除密钥；勾选后保存在本机，不加密，不跨设备同步。

远程服务要求 HTTPS；本地开发可使用 `http://localhost` 或 `http://127.0.0.1`。兼容服务需要支持所选协议，并按提示返回包含 `comment` 和 `explanationZh` 的 JSON。支持流式 SSE 和普通 JSON 响应。

## 草稿保护

空评论框自动填入；上次生成且未修改的内容可直接重新生成。其他已有文字会保留，用户可以明确点击“替换评论框内容”。“撤销填入”仅在本次填入的文字未被修改时恢复之前的文本，不恢复富文本格式。

插件读取已加载的帖子文字和回复父链，不分析图片或视频。页面结构变化导致填入校验失败时，可以从插件中复制草稿。首版覆盖新版 Reddit 的帖子页面。

## 开发

需要 Node.js 22.12+：

```sh
npm ci
npm run check
npm test
npm run build
npm run package
```

构建目录为 `dist/`，安装包位于 `artifacts/`。界面按浏览器语言显示中文或英文。

[验证记录](docs/verification.md) 区分了自动化测试、真实 Reddit 编辑器检查和真实模型接口验证。

## 开源许可

[MIT](LICENSE)。本项目与 Reddit、OpenAI 无隶属关系。
