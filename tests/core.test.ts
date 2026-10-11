import { describe, it, expect, vi, afterEach } from "vitest";
import { defaults, endpoint, parseDraft, prompt } from "../src/shared";
import { generate } from "../src/api";
const draft = {
  comment: "That sounds frustrating. Does it also happen with a fresh profile?",
  explanationZh: "先表示理解，再询问新配置文件是否也出现问题。",
};
const context = {
  title: "Startup issue",
  body: "Tabs restore old sessions.",
  community: "chrome",
  parents: ["Have you checked extensions?"],
};
afterEach(() => vi.unstubAllGlobals());
describe("provider endpoints", () => {
  it("allows HTTPS and local development only", () => {
    expect(endpoint("https://example.com/v1/").pathname).toBe("/v1");
    expect(endpoint("http://localhost:3000/v1").port).toBe("3000");
    for (const url of [
      "http://example.com/v1",
      "https://user:secret@example.com/v1",
      "https://example.com/v1?key=secret",
      "file:///etc/passwd",
    ])
      expect(() => endpoint(url)).toThrow();
  });
});
describe("draft validation", () => {
  it("keeps English and Chinese separate", () =>
    expect(parseDraft("```json\n" + JSON.stringify(draft) + "\n```")).toEqual(
      draft,
    ));
  it.each([
    "not json",
    '{"comment":"hi"}',
    '{"comment":"","explanationZh":"解释"}',
    JSON.stringify({ ...draft, comment: "x".repeat(10001) }),
  ])("rejects unusable output %#", (raw) =>
    expect(() => parseDraft(raw)).toThrow(),
  );
  it("bounds and quotes untrusted context", () => {
    const p = prompt(
      defaults,
      { ...context, body: "x".repeat(20000) },
      "my request",
    );
    expect(JSON.parse(p.user).reddit.body.length).toBe(12000);
    expect(p.system).toContain("untrusted");
    expect(p.system).toContain("explanationZh");
  });
});
describe.each(["responses", "chat"] as const)("%s transport", (protocol) => {
  const config = { ...defaults, model: "test-model", protocol };
  it("sends credentials only to configured provider and parses JSON", async () => {
    const payload =
      protocol === "responses"
        ? {
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: JSON.stringify(draft) }],
              },
            ],
          }
        : {
            choices: [
              {
                message: { content: JSON.stringify(draft) },
                finish_reason: "stop",
              },
            ],
          };
    const mock = vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", mock);
    expect(
      await generate(
        config,
        "private-key",
        context,
        "",
        new AbortController().signal,
      ),
    ).toEqual(draft);
    const [url, options] = mock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe("https://api.openai.com");
    expect(options.redirect).toBe("error");
    expect(options.body).not.toContain("private-key");
  });
  it("handles streaming split across arbitrary byte boundaries", async () => {
    const raw = JSON.stringify(draft);
    const events =
      protocol === "responses"
        ? [
            { type: "response.output_text.delta", delta: raw.slice(0, 20) },
            { type: "response.output_text.delta", delta: raw.slice(20) },
            { type: "response.completed", response: { status: "completed" } },
          ]
        : [
            { choices: [{ delta: { content: raw.slice(0, 20) } }] },
            {
              choices: [
                { delta: { content: raw.slice(20) }, finish_reason: "stop" },
              ],
            },
          ];
    const text =
      events.map((e) => "data: " + JSON.stringify(e) + "\r\n\r\n").join("") +
      (protocol === "chat" ? "data: [DONE]\r\n\r\n" : "");
    const bytes = new TextEncoder().encode(text);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              for (let i = 0; i < bytes.length; i += 7)
                c.enqueue(bytes.slice(i, i + 7));
              c.close();
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        ),
    );
    expect(
      await generate(config, "key", context, "", new AbortController().signal),
    ).toEqual(draft);
  });
  it("rejects truncated streams", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          "data: " +
            JSON.stringify(
              protocol === "responses"
                ? {
                    type: "response.output_text.delta",
                    delta: JSON.stringify(draft),
                  }
                : { choices: [{ delta: { content: JSON.stringify(draft) } }] },
            ) +
            "\n\n",
          { headers: { "content-type": "text/event-stream" } },
        ),
    );
    await expect(
      generate(config, "key", context, "", new AbortController().signal),
    ).rejects.toThrow("closed");
  });
  it.each([401, 403, 404, 429, 500])(
    "reports HTTP %s without exposing server text",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        async () => new Response("secret provider diagnostics", { status }),
      );
      await expect(
        generate(config, "key", context, "", new AbortController().signal),
      ).rejects.toThrow(`HTTP ${status}`);
    },
  );
});

describe("gateway address and response regressions", () => {
  it.each(["responses", "chat"] as const)(
    "normalizes a bare origin without double slashes for %s",
    async (protocol) => {
      const { requestEndpoint } = await import("../src/shared");
      const suffix =
        protocol === "responses" ? "responses" : "chat/completions";
      for (const base of [
        "https://gateway.example",
        "https://gateway.example/",
        "https://gateway.example/v1/",
      ]) {
        expect(requestEndpoint(base, protocol).href).toBe(
          `https://gateway.example/v1/${suffix}`,
        );
      }
      expect(
        requestEndpoint(`https://gateway.example/custom/v1/${suffix}`, protocol)
          .href,
      ).toBe(`https://gateway.example/custom/v1/${suffix}`);
      expect(
        requestEndpoint("https://gateway.example/custom/api", protocol).href,
      ).toBe(`https://gateway.example/custom/api/${suffix}`);
    },
  );
  it("rejects a full endpoint paired with the wrong protocol", async () => {
    const { requestEndpoint } = await import("../src/shared");
    expect(() =>
      requestEndpoint(
        "https://gateway.example/v1/chat/completions",
        "responses",
      ),
    ).toThrow("do not match");
  });
  it.each(["text/html", "application/json", "text/plain"])(
    "explains an HTML response labelled %s without exposing its body",
    async (contentType) => {
      vi.stubGlobal(
        "fetch",
        async () =>
          new Response("<!doctype html><html>private-upstream-token</html>", {
            headers: { "content-type": contentType },
          }),
      );
      await expect(
        generate(
          { ...defaults, baseUrl: "https://gateway.example", model: "fixture" },
          "key",
          context,
          "",
          new AbortController().signal,
        ),
      ).rejects.toThrow("HTML");
      try {
        await generate(
          { ...defaults, baseUrl: "https://gateway.example", model: "fixture" },
          "key",
          context,
          "",
          new AbortController().signal,
        );
      } catch (e) {
        expect((e as Error).message).not.toContain("private-upstream-token");
        expect((e as Error).message).toContain("/v1/responses");
      }
    },
  );
  it("explains malformed SSE JSON rather than exposing a JSON.parse exception", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("data: invalid-provider-data\n\n", {
          headers: { "content-type": "text/event-stream" },
        }),
    );
    await expect(
      generate(
        { ...defaults, model: "fixture" },
        "key",
        context,
        "",
        new AbortController().signal,
      ),
    ).rejects.toThrow("invalid JSON");
  });
});
