import {
  deepAll,
  editorFor,
  readEditor,
  getContext,
  fillVerified,
  visible,
  type Editor,
} from "./reddit";
import { normalize, type Draft } from "./shared";
const zh = navigator.language.toLowerCase().startsWith("zh");
const t = (en: string, cn: string) => (zh ? cn : en);
const mounts = new Map<Element, () => void>();
let route = location.href;
function mount(host: Element) {
  const shell = document.createElement("reddit-ai-assistant");
  const root = shell.attachShadow({ mode: "open" });
  root.innerHTML = `<style>:host{display:block;margin:10px 0;font:13px/1.5 system-ui;color:#26313c;color-scheme:light dark}*{box-sizing:border-box}.box{border:1px solid #ccd5dc;border-radius:12px;padding:10px;background:#f6f8fa}.row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}button,input,textarea{font:inherit}button{border:1px solid #bcc8d0;border-radius:18px;padding:6px 11px;background:#fff;color:#26313c;cursor:pointer}button.primary{background:#d93900;border-color:#d93900;color:white}button:disabled{opacity:.55;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #1683c7;outline-offset:2px}input,textarea{width:100%;margin:8px 0;border:1px solid #bcc8d0;border-radius:8px;padding:8px;background:white;color:inherit}textarea{min-height:95px;resize:vertical}.status{margin-top:6px;font-size:12px}.explanation{white-space:pre-wrap;margin:8px 0}details{margin-top:7px}summary{cursor:pointer}[hidden]{display:none!important}@media(prefers-color-scheme:dark){:host{color:#e1e7ed}.box{background:#192126;border-color:#3b494f}button,input,textarea{background:#263238;color:#e1e7ed;border-color:#53636b}}</style><div class="box"><div class="row"><button class="primary" id="generate">${t("Generate & fill", "生成并填入")}</button><button id="cancel" hidden>${t("Cancel", "取消")}</button><button id="settings">${t("Settings", "设置")}</button><button id="undo" hidden>${t("Undo fill", "撤销填入")}</button></div><details><summary>${t("Writing instructions for this reply", "本次评论要求")}</summary><input id="note" maxlength="2000" placeholder="${t("Your point, tone, or question…", "你想表达的观点、语气或问题…")}" aria-label="${t("Writing instructions", "本次评论要求")}"></details><div class="status" role="status" aria-live="polite"></div><div id="result" hidden><div class="explanation" lang="zh-CN"></div><details><summary>${t("View comment draft", "查看评论草稿")}</summary><textarea id="draft" readonly aria-label="Comment draft"></textarea></details><div class="row"><button id="copy">${t("Copy comment", "复制评论")}</button><button id="replace">${t("Replace editor text", "替换评论框内容")}</button></div></div></div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  for (const button of root.querySelectorAll<HTMLButtonElement>("button"))
    button.type = "button";
  const generate = $<HTMLButtonElement>("#generate"),
    cancel = $<HTMLButtonElement>("#cancel"),
    undo = $<HTMLButtonElement>("#undo");
  const status = $(".status");
  let port: chrome.runtime.Port | undefined,
    ping: ReturnType<typeof setInterval> | undefined,
    lastDraft: Draft | undefined,
    lastFilled = "",
    undoText = "",
    filledEditor: Editor | undefined,
    job = 0;
  function stop() {
    job++;
    port?.disconnect();
    port = undefined;
    clearInterval(ping);
    generate.disabled = false;
    cancel.hidden = true;
  }
  function currentEditor() {
    return editorFor(host);
  }
  function sameTarget(target: string, url: string) {
    try {
      return (
        host.isConnected &&
        location.href === url &&
        getContext(host).target === target
      );
    } catch {
      return false;
    }
  }
  async function fill(text: string, editor: Editor) {
    const previous = readEditor(editor);
    try {
      await fillVerified(editor, text);
    } finally {
      undoText = previous;
      lastFilled = readEditor(editor);
      filledEditor = editor;
      undo.hidden = false;
    }
    status.textContent = t(
      "Filled. Review your comment and click Reddit’s Comment button yourself.",
      "已填入。检查内容后，请手动点击 Reddit 的发布按钮。",
    );
  }
  $("#settings").onclick = () =>
    chrome.runtime.sendMessage({ type: "settings" });
  cancel.onclick = () => {
    stop();
    status.textContent = t("Cancelled.", "已取消。");
  };
  $("#copy").onclick = async () => {
    if (!lastDraft) return;
    try {
      await navigator.clipboard.writeText(lastDraft.comment);
      status.textContent = t("Comment copied.", "评论已复制。");
    } catch {
      status.textContent = t(
        "Select and copy the text in the draft below.",
        "请展开下方草稿并手动复制。",
      );
      $<HTMLTextAreaElement>("#draft").parentElement!.setAttribute("open", "");
      $<HTMLTextAreaElement>("#draft").select();
    }
  };
  $("#replace").onclick = async () => {
    const editor = currentEditor();
    if (!editor || !lastDraft) {
      status.textContent = t(
        "Open the reply editor first.",
        "请先展开对应的评论框。",
      );
      return;
    }
    try {
      await fill(lastDraft.comment, editor);
    } catch (e) {
      status.textContent = (e as Error).message;
    }
  };
  undo.onclick = async () => {
    if (
      !filledEditor ||
      !filledEditor.isConnected ||
      normalize(readEditor(filledEditor)) !== normalize(lastFilled)
    ) {
      status.textContent = t(
        "Your text changed; undo will not overwrite it.",
        "文字已被修改，撤销不会覆盖你的修改。",
      );
      return;
    }
    try {
      await fillVerified(filledEditor, undoText);
      undo.hidden = true;
      lastFilled = "";
      status.textContent = t("Previous text restored.", "已恢复之前的文字。");
    } catch (e) {
      status.textContent = (e as Error).message;
    }
  };
  generate.onclick = async () => {
    stop();
    const id = job;
    generate.disabled = true;
    cancel.hidden = false;
    status.textContent = t("Generating…", "正在生成…");
    try {
      const { context, target } = getContext(host);
      const url = location.href;
      let editor = currentEditor();
      if (!editor) {
        const trigger = deepAll<HTMLTextAreaElement>("textarea", host).find(
          visible,
        );
        trigger?.click();
        trigger?.focus();
        for (let i = 0; i < 15 && !editor; i++) {
          await new Promise((r) => setTimeout(r, 100));
          if (id !== job) return;
          editor = currentEditor();
        }
      }
      if (!editor)
        throw new Error(
          t(
            "Open an editable Reddit comment field first.",
            "请先展开一个可以输入的 Reddit 评论框。",
          ),
        );
      const capturedEditor = editor;
      const baseline = editor ? readEditor(editor) : undefined;
      port = chrome.runtime.connect({ name: "generate" });
      const activePort = port;
      ping = setInterval(() => {
        try {
          activePort.postMessage({ type: "ping" });
        } catch {}
      }, 15000);
      activePort.onDisconnect.addListener(() => {
        if (port === activePort) {
          stop();
          status.textContent = t(
            "Connection ended. Check settings and try again.",
            "连接已结束，请检查设置后重试。",
          );
        }
      });
      activePort.onMessage.addListener(async (msg) => {
        if (id !== job || msg.type === "pong") return;
        if (msg.type === "error") {
          stop();
          status.textContent = msg.error;
          return;
        }
        if (msg.type !== "result") return;
        const valid = sameTarget(target, url);
        stop();
        if (!valid) return;
        lastDraft = msg.draft;
        generate.textContent = t("Regenerate & fill", "重新生成并填入");
        $("#result").hidden = false;
        $(".explanation").textContent = lastDraft!.explanationZh;
        $<HTMLTextAreaElement>("#draft").value = lastDraft!.comment;
        const now = currentEditor();
        if (
          now &&
          now === capturedEditor &&
          baseline !== undefined &&
          readEditor(now) === baseline &&
          (!normalize(baseline) ||
            normalize(baseline) === normalize(lastFilled))
        ) {
          try {
            await fill(lastDraft!.comment, now);
          } catch (e) {
            status.textContent = (e as Error).message;
          }
        } else
          status.textContent = t(
            "Draft ready. Existing text was preserved; use Copy or Replace.",
            "草稿已生成，已有文字已保留。可选择复制或替换。",
          );
      });
      activePort.postMessage({
        type: "generate",
        context,
        note: $<HTMLInputElement>("#note").value,
      });
    } catch (e) {
      stop();
      status.textContent = (e as Error).message;
    }
  };
  (host.shadowRoot || host).append(shell);
  mounts.set(host, () => {
    stop();
    shell.remove();
  });
}
function scan() {
  if (location.href !== route) {
    for (const dispose of mounts.values()) dispose();
    mounts.clear();
    route = location.href;
  }
  for (const [host, dispose] of mounts)
    if (!host.isConnected) {
      dispose();
      mounts.delete(host);
    }
  if (!location.pathname.includes("/comments/")) return;
  for (const host of deepAll("comment-composer-host"))
    if (!mounts.has(host) && visible(host)) mount(host);
}
let scheduled = false;
const observer = new MutationObserver(() => {
  if (!scheduled) {
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      scan();
    }, 350);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setInterval(scan, 1800);
scan();
