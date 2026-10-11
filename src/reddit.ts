import { normalize, type Context } from "./shared";
export function deepAll<T extends Element = Element>(
  selector: string,
  root: Document | ShadowRoot | Element = document,
): T[] {
  const out = Array.from(root.querySelectorAll<T>(selector));
  for (const el of root.querySelectorAll("*"))
    if (el.shadowRoot) out.push(...deepAll<T>(selector, el.shadowRoot));
  return out;
}
export function ancestor(
  el: Element | null | undefined,
  selector: string,
): Element | null {
  let current: Element | null = el || null;
  while (current) {
    if (current.matches(selector)) return current;
    current =
      current.parentElement ||
      (current.getRootNode() as ShadowRoot).host ||
      null;
  }
  return null;
}
export function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"
  );
}
export type Editor = HTMLElement | HTMLTextAreaElement;
export function editorFor(host: Element): Editor | undefined {
  return deepAll<Editor>(
    '[contenteditable="true"][data-lexical-editor],textarea',
    host,
  ).find(
    (el) =>
      visible(el) &&
      !(el as HTMLTextAreaElement).disabled &&
      !(el as HTMLTextAreaElement).readOnly &&
      !ancestor(el, "reddit-ai-assistant") &&
      (el.matches("[contenteditable]") || !!ancestor(el, "shreddit-composer")),
  );
}
export function readEditor(el: Editor) {
  return el instanceof HTMLTextAreaElement ? el.value : el.innerText;
}
export async function writeEditor(el: Editor, text: string) {
  const before = readEditor(el);
  el.focus();
  if (el instanceof HTMLTextAreaElement) {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // Focusing a different composer can restore Lexical's previous caret on
    // the next task. Wait for that restoration before selecting all text.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const root = el.getRootNode() as ShadowRoot & {
      getSelection?: () => Selection;
    };
    const selection = root.getSelection?.() || window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Let Lexical consume selectionchange before dispatching paste; otherwise
    // its internal selection can still point at the end of the previous draft.
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (!el.isConnected || readEditor(el) !== before)
      throw new Error(
        "The editor changed before insertion. Your text was preserved.",
      );
    if (!normalize(text)) {
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Backspace",
          code: "Backspace",
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    } else {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      // Lexical turns each plain-text newline into a paragraph. Supply safe HTML
      // so blank-line-separated paragraphs survive a real paste without duplication.
      const container = document.createElement("div");
      for (const paragraph of text.split("\n\n")) {
        const p = document.createElement("p");
        paragraph.split("\n").forEach((line, index) => {
          if (index) p.append(document.createElement("br"));
          p.append(document.createTextNode(line));
        });
        container.append(p);
      }
      data.setData("text/html", container.innerHTML);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    }
  }
}
export function getContext(host: Element): {
  context: Context;
  target: string;
} {
  const post =
    document.querySelector("main shreddit-post") ||
    document.querySelector("shreddit-post");
  if (!post) throw new Error("Open a Reddit post first.");
  const comments: Element[] = [];
  let comment = ancestor(host, "shreddit-comment");
  while (comment) {
    comments.unshift(comment);
    comment = ancestor(
      comment.parentElement || (comment.getRootNode() as ShadowRoot).host,
      "shreddit-comment",
    );
  }
  return {
    target: `${post.id}:${comments.at(-1)?.getAttribute("thingid") || "post"}`,
    context: {
      title:
        post.getAttribute("post-title") ||
        document.querySelector("h1")?.textContent ||
        "",
      body: post.querySelector('[slot="text-body"]')?.textContent?.trim() || "",
      community: post.getAttribute("subreddit-name") || "",
      parents: comments.map(
        (c) => c.querySelector('[slot="comment"]')?.textContent?.trim() || "",
      ),
    },
  };
}
export async function fillVerified(el: Editor, text: string) {
  await writeEditor(el, text);
  await new Promise((r) => setTimeout(r, 120));
  verifyEditor(el, text);
}

export function verifyEditor(el: Editor, text: string) {
  if (normalize(readEditor(el)) !== normalize(text))
    throw new Error(
      "Reddit did not accept the text exactly. The draft is available below; copy it into the editor.",
    );
  if (el instanceof HTMLTextAreaElement) return;
  const composer = ancestor(el, "shreddit-composer") as
    (Element & { value?: string }) | null;
  if (typeof composer?.value !== "string") return;
  // Validate the public form value as well as the rendered DOM. A DOM-only
  // edit can look correct while Reddit would submit stale Lexical state.
  try {
    const value = JSON.parse(composer.value);
    const plain = (node: { e?: string; t?: string; c?: unknown[] }): string => {
      if (node.e === "text") return node.t || "";
      if (node.e === "br") return "\n";
      if (Array.isArray(node.c))
        return node.c.map((child) => plain(child as typeof node)).join("");
      throw new Error("Unknown editor node");
    };
    if (
      !Array.isArray(value.document) ||
      normalize(value.document.map(plain).join("\n\n")) !== normalize(text)
    )
      throw new Error("Stale editor state");
  } catch {
    throw new Error(
      "Reddit’s form state could not be verified. Copy the draft or undo this insertion.",
    );
  }
}
