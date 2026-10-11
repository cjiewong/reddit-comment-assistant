import { visible } from "./reddit";
const zh = navigator.language.toLowerCase().startsWith("zh");
const t = (en: string, cn: string) => (zh ? cn : en);
const entries = new Map<Element, { shell: HTMLElement; dispose: () => void }>();
export function clearTranslations() {
  for (const entry of entries.values()) entry.dispose();
  entries.clear();
}
function mount(
  source: Element,
  anchor: Element,
  read: () => string,
  isPost: boolean,
) {
  const shell = document.createElement("reddit-ai-translation");
  if (!isPost && anchor.hasAttribute("slot"))
    shell.slot = anchor.getAttribute("slot")!;
  const root = shell.attachShadow({ mode: "open" });
  root.innerHTML = `<style>:host{display:block;margin:8px 0;font:13px/1.6 system-ui;color:inherit}button{font:inherit;cursor:pointer;border:1px solid #aebbc4;border-radius:16px;padding:4px 12px;color:inherit;background:transparent}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:2px solid #1683c7;outline-offset:2px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.status{font-size:12px}.text{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid #d93900;padding:8px 12px;margin:8px 0}[hidden]{display:none!important}</style><div class="row"><button type="button" id="translate">${isPost ? t("Translate post", "翻译帖子") : t("Translate comment", "翻译评论")}</button><button type="button" id="cancel" hidden>${t("Cancel", "取消")}</button><button type="button" id="toggle" hidden>${t("Hide translation", "收起译文")}</button><span class="status" role="status" aria-live="polite"></span></div><div class="text" hidden></div>`;
  const button = root.querySelector<HTMLButtonElement>("#translate")!;
  const cancel = root.querySelector<HTMLButtonElement>("#cancel")!;
  const toggle = root.querySelector<HTMLButtonElement>("#toggle")!;
  const output = root.querySelector<HTMLElement>(".text")!;
  const status = root.querySelector<HTMLElement>(".status")!;
  let port: chrome.runtime.Port | undefined,
    timer: ReturnType<typeof setInterval> | undefined,
    job = 0;
  function stop() {
    job++;
    const previous = port;
    port = undefined;
    previous?.disconnect();
    clearInterval(timer);
    button.disabled = false;
    cancel.hidden = true;
  }
  cancel.onclick = () => {
    stop();
    status.textContent = t("Cancelled.", "已取消。");
  };
  toggle.onclick = () => {
    output.hidden = !output.hidden;
    toggle.textContent = output.hidden
      ? t("Show translation", "展开译文")
      : t("Hide translation", "收起译文");
  };
  button.onclick = () => {
    stop();
    const id = job;
    const url = location.href;
    const text = read().trim();
    if (!text || text.length > 60000) {
      status.textContent = t(
        "Translation requires 1–60,000 characters.",
        "翻译内容需为 1–60,000 字符。",
      );
      return;
    }
    button.disabled = true;
    cancel.hidden = false;
    status.textContent = t("Translating…", "正在翻译…");
    try {
      const active = chrome.runtime.connect({ name: "generate" });
      port = active;
      timer = setInterval(() => {
        try {
          active.postMessage({ type: "ping" });
        } catch {}
      }, 15000);
      active.onDisconnect.addListener(() => {
        if (port === active) {
          stop();
          status.textContent = t(
            "Connection ended. Check settings and try again.",
            "连接已结束，请检查模型设置后重试。",
          );
        }
      });
      active.onMessage.addListener((message) => {
        if (id !== job || message.type === "pong") return;
        if (message.type === "error") {
          stop();
          status.textContent = message.error;
          return;
        }
        if (message.type !== "result") return;
        stop();
        if (
          !source.isConnected ||
          location.href !== url ||
          read().trim() !== text
        )
          return;
        if (typeof message.translation !== "string") {
          status.textContent = t(
            "Invalid translation response.",
            "翻译响应格式不正确。",
          );
          return;
        }
        output.textContent = message.translation;
        output.hidden = false;
        toggle.hidden = false;
        toggle.textContent = t("Hide translation", "收起译文");
        status.textContent = t("Translated by your model.", "由当前模型翻译。");
        button.textContent = t("Translate again", "重新翻译");
      });
      active.postMessage({ type: "translate", text });
    } catch (e) {
      stop();
      status.textContent = (e as Error).message;
    }
  };
  anchor.after(shell);
  entries.set(source, {
    shell,
    dispose: () => {
      stop();
      shell.remove();
    },
  });
}
export function scanTranslations() {
  for (const [source, entry] of entries)
    if (!source.isConnected || !entry.shell.isConnected) {
      entry.dispose();
      entries.delete(source);
    }
  const post = document.querySelector("main shreddit-post");
  if (post && !entries.has(post) && visible(post))
    mount(
      post,
      post,
      () =>
        [
          post.getAttribute("post-title") || "",
          post.querySelector('[slot="text-body"]')?.textContent || "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      true,
    );
  for (const comment of document.querySelectorAll("shreddit-comment")) {
    const body = comment.querySelector('[slot="comment"]');
    if (
      body &&
      body.closest("shreddit-comment") === comment &&
      !entries.has(comment) &&
      visible(body)
    )
      mount(comment, body, () => body.textContent || "", false);
  }
}
