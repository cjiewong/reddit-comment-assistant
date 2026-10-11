// @vitest-environment jsdom
import { it, expect, beforeEach, vi } from "vitest";
import { deepAll, getContext, fillVerified } from "../src/reddit";
beforeEach(() => {
  document.body.innerHTML =
    '<main><shreddit-post id="t3_test" post-title="A question" subreddit-name="example"><div slot="text-body">Post body</div></shreddit-post><shreddit-comment thingid="t1_parent"><div slot="comment">Parent comment</div><shreddit-comment thingid="t1_child"><div slot="comment">Child comment</div><comment-composer-host></comment-composer-host></shreddit-comment></shreddit-comment></main>';
});
it("extracts correct parent chain and thread identity", () => {
  const host = document.querySelector("comment-composer-host")!;
  const result = getContext(host);
  expect(result.target).toBe("t3_test:t1_child");
  expect(result.context.parents).toEqual(["Parent comment", "Child comment"]);
  expect(result.context.body).toBe("Post body");
});
it("traverses open shadow roots", () => {
  const host = document.querySelector("comment-composer-host")!;
  host.attachShadow({ mode: "open" }).innerHTML = "<textarea></textarea>";
  expect(deepAll("textarea")).toHaveLength(1);
});
it("textarea fills dispatch input and preserve paragraphs", async () => {
  const el = document.createElement("textarea");
  document.body.append(el);
  const input = vi.fn();
  el.addEventListener("input", input);
  await fillVerified(el, "First paragraph.\n\nSecond paragraph.");
  expect(input).toHaveBeenCalledOnce();
  expect(el.value).toBe("First paragraph.\n\nSecond paragraph.");
});

it("rejects stale serialized state even when visible editor text is correct", async () => {
  const { verifyEditor } = await import("../src/reddit");
  const composer = document.createElement(
    "shreddit-composer",
  ) as HTMLElement & { value: string };
  const editor = document.createElement("div");
  editor.innerText = "The new draft";
  composer.append(editor);
  composer.value = JSON.stringify({
    document: [{ e: "par", c: [{ e: "text", t: "The old draft" }] }],
  });
  expect(() => verifyEditor(editor, "The new draft")).toThrow("form state");
  composer.value = JSON.stringify({
    document: [{ e: "par", c: [{ e: "text", t: "The new draft" }] }],
  });
  expect(() => verifyEditor(editor, "The new draft")).not.toThrow();
});
