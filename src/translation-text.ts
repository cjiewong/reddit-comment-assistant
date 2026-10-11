/** Collapse layout whitespace outside fenced code without merging paragraphs. */
export function compactTranslation(text: string): string {
  const result: string[] = [];
  let fence = "";
  for (const raw of text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")) {
    const marker = raw.trim().match(/^(`{3,}|~{3,})/);
    if (marker && (!fence || marker[1][0] === fence[0])) {
      fence = fence ? "" : marker[1];
      result.push(raw.trim());
      continue;
    }
    if (fence) {
      result.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (result.length && result.at(-1) !== "") result.push("");
    } else {
      // Keep indentation for nested list markers; remove HTML layout indentation.
      result.push(
        /^\s*(?:[-*+] |\d+[.)] )/.test(line) ? line : line.trimStart(),
      );
    }
  }
  return result.join("\n").trim();
}

/** Serialize visible content structure rather than HTML source indentation. */
export function extractTranslationText(root: Element | null): string {
  if (!root) return "";
  function visit(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE)
      return (node.textContent || "").replace(/\s+/g, " ");
    if (!(node instanceof Element)) return "";
    if (
      node.matches(
        'script,style,noscript,template,[hidden],[aria-hidden="true"]',
      )
    )
      return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "\n";
    if (tag === "pre")
      return (
        "\n\n```\n" + (node.textContent || "").replace(/\n$/, "") + "\n```\n\n"
      );
    if (tag === "ul" || tag === "ol") {
      const start = Number(node.getAttribute("start")) || 1;
      return (
        "\n\n" +
        Array.from(node.children)
          .filter((el) => el.tagName === "LI")
          .map((li, index) => {
            const text = compactTranslation(
              Array.from(li.childNodes).map(visit).join(""),
            );
            const prefix = tag === "ol" ? `${start + index}. ` : "- ";
            return prefix + text.replace(/\n/g, "\n  ");
          })
          .join("\n") +
        "\n\n"
      );
    }
    const text = Array.from(node.childNodes).map(visit).join("");
    return /^(p|div|section|article|h[1-6]|blockquote)$/.test(tag)
      ? "\n\n" + text + "\n\n"
      : text;
  }
  return compactTranslation(visit(root));
}

/** Safe, compact paragraphs/lists. Model HTML is never interpreted. */
export function renderTranslation(container: HTMLElement, raw: string) {
  container.replaceChildren();
  const lines = compactTranslation(raw).split("\n");
  let paragraph: string[] = [];
  const lists: {
    indent: number;
    list: HTMLUListElement | HTMLOListElement;
    item?: HTMLLIElement;
  }[] = [];
  function flush() {
    if (paragraph.length) {
      const p = document.createElement("p");
      p.textContent = paragraph.join("\n");
      container.append(p);
      paragraph = [];
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      flush();
      lists.length = 0;
      const code: string[] = [];
      for (++i; i < lines.length && !lines[i].startsWith(fence[1]); i++)
        code.push(lines[i]);
      const pre = document.createElement("pre");
      pre.textContent = code.join("\n");
      container.append(pre);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const bullet = line.match(/^(\s*)(?:([-*+])\s+|(\d+)[.)]\s+)(.+)$/);
    if (bullet) {
      flush();
      const ordered = !!bullet[3];
      const indent = bullet[1].replace(/\t/g, "    ").length;
      while (lists.length && lists.at(-1)!.indent > indent) lists.pop();
      if (
        lists.at(-1)?.indent === indent &&
        (lists.at(-1)!.list.tagName === "OL") !== ordered
      )
        lists.pop();
      if (!lists.length || lists.at(-1)!.indent < indent) {
        const list = document.createElement(ordered ? "ol" : "ul");
        if (ordered) (list as HTMLOListElement).start = Number(bullet[3]);
        (lists.at(-1)?.item || container).append(list);
        lists.push({ indent, list });
      }
      const li = document.createElement("li");
      li.textContent = bullet[4];
      if (ordered) li.value = Number(bullet[3]);
      lists.at(-1)!.list.append(li);
      lists.at(-1)!.item = li;
    } else {
      lists.length = 0;
      paragraph.push(line);
    }
  }
  flush();
}
