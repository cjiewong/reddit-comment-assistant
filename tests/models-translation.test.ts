import { it, expect, vi, afterEach } from "vitest";
import { defaults, modelsEndpoint } from "../src/shared";
import { listModels, generate, translate } from "../src/api";
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["https://gateway.example", "https://gateway.example/v1/models"],
  ["https://gateway.example/v1/", "https://gateway.example/v1/models"],
  [
    "https://gateway.example/custom/v1/responses",
    "https://gateway.example/custom/v1/models",
  ],
  [
    "https://gateway.example/custom/chat/completions",
    "https://gateway.example/custom/models",
  ],
  ["https://gateway.example/responses", "https://gateway.example/models"],
])("discovers the model endpoint for %s", (base, expected) =>
  expect(modelsEndpoint(base).href).toBe(expected),
);
it("fetches, validates, deduplicates and sorts model IDs without a generation request", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "z-model" },
            { id: "a-model" },
            { id: "a-model" },
            null,
            { id: 123 },
            { id: "" },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await listModels(
      "https://gateway.example",
      "fixture-key",
      new AbortController().signal,
    ),
  ).toEqual(["a-model", "z-model"]);
  const [url, options] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.pathname).toBe("/v1/models");
  expect(options.body).toBeUndefined();
  expect(options.redirect).toBe("error");
  expect(options.headers).toMatchObject({
    Authorization: "Bearer fixture-key",
  });
});
it("handles empty model lists", async () => {
  vi.stubGlobal("fetch", async () => new Response('{"data":[]}'));
  expect(
    await listModels(
      "https://gateway.example",
      "key",
      new AbortController().signal,
    ),
  ).toEqual([]);
});
it.each([401, 403, 404, 500])("reports model-list HTTP %s", async (status) => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("private detail", { status }),
  );
  await expect(
    listModels("https://gateway.example", "key", new AbortController().signal),
  ).rejects.toThrow(`HTTP ${status}`);
});
it("rejects malformed model lists", async () => {
  vi.stubGlobal("fetch", async () => new Response('{"wrong":[]}'));
  await expect(
    listModels("https://gateway.example", "key", new AbortController().signal),
  ).rejects.toThrow("data[].id");
});
it.each(["responses", "chat"] as const)(
  "sends effort in the correct %s field for drafting and translation",
  async (protocol) => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            protocol === "responses"
              ? {
                  status: "completed",
                  output: [
                    {
                      content: [
                        {
                          type: "output_text",
                          text: '{"comment":"Hello","explanationZh":"你好","translation":"译文"}',
                        },
                      ],
                    },
                  ],
                }
              : {
                  choices: [
                    {
                      message: {
                        content:
                          '{"comment":"Hello","explanationZh":"你好","translation":"译文"}',
                      },
                      finish_reason: "stop",
                    },
                  ],
                },
          ),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const config = { ...defaults, protocol, model: "fixture", effort: "high" };
    await generate(
      config,
      "key",
      { title: "Title", body: "Body", community: "example", parents: [] },
      "",
      new AbortController().signal,
    );
    expect(
      await translate(
        config,
        "key",
        "Original text",
        new AbortController().signal,
      ),
    ).toBe("译文");
    for (const call of fetcher.mock.calls) {
      const body = JSON.parse(
        (call as unknown as [URL, RequestInit])[1].body as string,
      );
      if (protocol === "responses") {
        expect(body.reasoning).toEqual({ effort: "high" });
        expect(body).not.toHaveProperty("reasoning_effort");
      } else {
        expect(body.reasoning_effort).toBe("high");
        expect(body).not.toHaveProperty("reasoning");
      }
    }
    const translationBody = JSON.parse(
      (fetcher.mock.calls[1] as unknown as [URL, RequestInit])[1]
        .body as string,
    );
    expect(JSON.stringify(translationBody)).toContain("Original text");
    expect(JSON.stringify(translationBody)).toContain("Simplified Chinese");
  },
);
it.each(["responses", "chat"] as const)(
  "omits default effort for %s",
  async (protocol) => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            protocol === "responses"
              ? {
                  output: [
                    {
                      content: [
                        { type: "output_text", text: '{"translation":"译文"}' },
                      ],
                    },
                  ],
                }
              : {
                  choices: [{ message: { content: '{"translation":"译文"}' } }],
                },
          ),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    await translate(
      { ...defaults, model: "fixture", protocol },
      "key",
      "Text",
      new AbortController().signal,
    );
    const body = JSON.parse(
      (fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1]
        .body as string,
    );
    expect(body).not.toHaveProperty("reasoning");
    expect(body).not.toHaveProperty("reasoning_effort");
  },
);
it("rejects missing translations", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        '{"output":[{"content":[{"type":"output_text","text":"{}"}]}]}',
      ),
  );
  await expect(
    translate(
      { ...defaults, model: "fixture" },
      "key",
      "Text",
      new AbortController().signal,
    ),
  ).rejects.toThrow("empty translation");
});
it("rejects oversized source without making a provider request", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await expect(
    translate(
      { ...defaults, model: "fixture" },
      "key",
      "x".repeat(60001),
      new AbortController().signal,
    ),
  ).rejects.toThrow("60,000");
  expect(f).not.toHaveBeenCalled();
});
