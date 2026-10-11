// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanTranslations, clearTranslations } from "../src/translation";
let listeners: Array<(message: unknown) => void>;
let ports: Array<{
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}>;
beforeEach(() => {
  listeners = [];
  ports = [];
  document.body.innerHTML =
    '<main><shreddit-post post-title="Post title"><div slot="text-body">Post body</div></shreddit-post><shreddit-comment><div slot="comment">Parent text</div><shreddit-comment><div slot="comment">Child text</div></shreddit-comment></shreddit-comment></main>';
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 100,
    height: 40,
  } as DOMRect);
  vi.stubGlobal("chrome", {
    runtime: {
      connect: vi.fn(() => {
        const port = {
          postMessage: vi.fn(),
          disconnect: vi.fn(),
          onMessage: {
            addListener: (fn: (msg: unknown) => void) => listeners.push(fn),
          },
          onDisconnect: { addListener: vi.fn() },
        };
        ports.push(port);
        return port;
      }),
    },
  });
});
afterEach(() => {
  clearTranslations();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("mounts once and only requests translation on a manual click", () => {
  scanTranslations();
  scanTranslations();
  expect(document.querySelectorAll("reddit-ai-translation")).toHaveLength(3);
  expect(chrome.runtime.connect).not.toHaveBeenCalled();
  const root = document.querySelector("reddit-ai-translation")!.shadowRoot!;
  root.querySelector<HTMLButtonElement>("#translate")!.click();
  expect(ports[0].postMessage).toHaveBeenCalledWith({
    type: "translate",
    text: "Post title\n\nPost body",
  });
  listeners[0]({
    type: "result",
    translation: "<script>plain translated text</script>",
  });
  expect(root.querySelector(".text")!.textContent).toBe(
    "<script>plain translated text</script>",
  );
  expect(root.querySelector(".text script")).toBeNull();
});
it("translates only the selected comment, not descendants", () => {
  scanTranslations();
  const comment = document.querySelector("shreddit-comment")!;
  comment
    .querySelector("reddit-ai-translation")!
    .shadowRoot!.querySelector<HTMLButtonElement>("#translate")!
    .click();
  expect(ports[0].postMessage).toHaveBeenCalledWith({
    type: "translate",
    text: "Parent text",
  });
});
it("ignores cancelled results and disconnects removed nodes", () => {
  scanTranslations();
  const root = document.querySelector("reddit-ai-translation")!.shadowRoot!;
  root.querySelector<HTMLButtonElement>("#translate")!.click();
  root.querySelector<HTMLButtonElement>("#cancel")!.click();
  listeners[0]({ type: "result", translation: "Late translation" });
  expect(root.querySelector(".text")!.textContent).toBe("");
  expect(ports[0].disconnect).toHaveBeenCalled();
  document.querySelector("shreddit-post")!.remove();
  scanTranslations();
  expect(document.querySelectorAll("reddit-ai-translation")).toHaveLength(2);
});
