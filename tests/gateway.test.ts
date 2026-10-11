import { createServer } from "node:http";
import { once } from "node:events";
import { it, expect } from "vitest";
import { generate } from "../src/api";
import { defaults } from "../src/shared";

it("uses /v1/responses on a real HTTP gateway whose frontend fallback serves HTML", async () => {
  const paths: string[] = [];
  const draft = {
    comment: "A useful comment.",
    explanationZh: "一条有帮助的评论。",
  };
  const server = createServer((req, res) => {
    paths.push(req.url!);
    req.resume();
    if (req.url === "/v1/responses") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "completed",
          output: [
            { content: [{ type: "output_text", text: JSON.stringify(draft) }] },
          ],
        }),
      );
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end("<!doctype html><html>Gateway dashboard</html>");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as { port: number };
    const result = await generate(
      {
        ...defaults,
        baseUrl: `http://127.0.0.1:${address.port}`,
        model: "fixture",
      },
      "fixture-key",
      { title: "Test", body: "Test post", community: "example", parents: [] },
      "",
      new AbortController().signal,
    );
    expect(result).toEqual(draft);
    expect(paths).toEqual(["/v1/responses"]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
