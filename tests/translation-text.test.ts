// @vitest-environment jsdom
import { it, expect } from "vitest";
import {
  compactTranslation,
  extractTranslationText,
  renderTranslation,
} from "../src/translation-text";
it("removes HTML indentation and blank spacer paragraphs while retaining paragraph and list boundaries", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <p>First <strong>paragraph</strong>.</p>
    <p><br></p>
    <p>Second paragraph.</p>
    <ul>
      <li><p>One</p></li>
      <li><p>Two</p></li>
    </ul>
 `;
  expect(extractTranslationText(root)).toBe(
    "First paragraph.\n\nSecond paragraph.\n\n- One\n- Two",
  );
});
it("keeps inline spacing, explicit line breaks, ordered numbering and code indentation", () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<p>A <a href="#">link</a> here<br>Next line</p><ol start="3"><li>Third</li><li>Fourth</li></ol><pre>if x:\n    run()\n\n\n    done()</pre>';
  expect(extractTranslationText(root)).toBe(
    "A link here\nNext line\n\n3. Third\n4. Fourth\n\n```\nif x:\n    run()\n\n\n    done()\n```",
  );
});
it("compacts noisy translations into bounded paragraph spacing", () => {
  const input = "  标题\r\n\r\n    \r\n\r\n   第一段\n\n\n\n第二段\n\n";
  expect(compactTranslation(input)).toBe("标题\n\n第一段\n\n第二段");
  const output = document.createElement("div");
  renderTranslation(output, input);
  expect(Array.from(output.children).map((p) => p.textContent)).toEqual([
    "标题",
    "第一段",
    "第二段",
  ]);
});
it("renders loose and nested lists without blank spacer nodes", () => {
  const output = document.createElement("div");
  renderTranslation(
    output,
    "介绍\n\n- 第一项\n\n\n  - 子项\n\n- 第二项\n\n结束",
  );
  expect(output.children.length).toBe(3);
  expect(output.querySelectorAll(":scope > ul > li")).toHaveLength(2);
  expect(output.querySelector("ul ul li")!.textContent).toBe("子项");
});
it("preserves code whitespace and renders model markup as inert text", () => {
  const output = document.createElement("div");
  renderTranslation(
    output,
    "<img src=x onerror=alert(1)>\n\n```python\nif x:\n    run()\n\n\n    done()\n```",
  );
  expect(output.querySelector("img")).toBeNull();
  expect(output.querySelector("p")!.textContent).toContain("<img");
  expect(output.querySelector("pre")!.textContent).toBe(
    "if x:\n    run()\n\n\n    done()",
  );
});
