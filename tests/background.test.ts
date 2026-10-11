import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { generate } from "../src/api";
vi.mock("../src/api", () => ({ generate: vi.fn() }));
let connect: (port: any) => void;
let contains = vi.fn(async () => true);
const local = {
  config: { model: "fixture-model", rememberKey: false },
  apiKey: "persisted-fixture-key",
};
beforeEach(async () => {
  vi.resetModules();
  vi.mocked(generate).mockReset();
  contains = vi.fn(async () => true);
  vi.stubGlobal("chrome", {
    runtime: {
      id: "fixture-extension",
      openOptionsPage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onConnect: {
        addListener: (fn: typeof connect) => {
          connect = fn;
        },
      },
    },
    action: { onClicked: { addListener: vi.fn() } },
    storage: {
      local: {
        setAccessLevel: vi.fn(async () => {}),
        get: vi.fn(async () => local),
      },
      session: {
        setAccessLevel: vi.fn(async () => {}),
        get: vi.fn(async () => ({ apiKey: "session-fixture-key" })),
      },
    },
    permissions: { contains },
  });
  await import("../src/background");
});
afterEach(() => vi.unstubAllGlobals());
function port(url = "https://www.reddit.com/r/example/comments/fixture/post/") {
  const handlers: {
    message?: (m: unknown) => Promise<void>;
    disconnect?: () => void;
  } = {};
  const value = {
    name: "generate",
    sender: { id: "fixture-extension", url },
    disconnect: vi.fn(),
    postMessage: vi.fn(),
    onMessage: {
      addListener: (fn: (m: unknown) => Promise<void>) =>
        (handlers.message = fn),
    },
    onDisconnect: {
      addListener: (fn: () => void) => (handlers.disconnect = fn),
    },
  };
  connect(value);
  return { value, handlers };
}
const request = {
  type: "generate",
  context: {
    title: "Fixture",
    body: "A question",
    community: "example",
    parents: [],
  },
  note: "",
};
it("rejects connections from other origins", () => {
  const p = port("https://example.com/");
  expect(p.value.disconnect).toHaveBeenCalledOnce();
  expect(p.handlers.message).toBeUndefined();
});
it("uses session credentials and returns only the draft", async () => {
  const draft = {
    comment: "A helpful reply.",
    explanationZh: "一条简短回复。",
  };
  vi.mocked(generate).mockResolvedValue(draft);
  const p = port();
  await p.handlers.message!(request);
  expect(vi.mocked(generate).mock.calls[0][1]).toBe("session-fixture-key");
  expect(p.value.postMessage).toHaveBeenCalledWith({ type: "result", draft });
  expect(JSON.stringify(p.value.postMessage.mock.calls)).not.toContain(
    "fixture-key",
  );
});
it("does not call the provider without host permission", async () => {
  contains.mockResolvedValue(false);
  const p = port();
  await p.handlers.message!(request);
  expect(generate).not.toHaveBeenCalled();
  expect(p.value.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: "error" }),
  );
});
it("aborts a provider request when the editor disconnects", async () => {
  vi.mocked(generate).mockImplementation(
    (_c, _k, _ctx, _note, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("Aborted"))),
      ),
  );
  const p = port();
  const pending = p.handlers.message!(request);
  await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
  const signal = vi.mocked(generate).mock.calls[0][4];
  p.handlers.disconnect!();
  await pending;
  expect(signal.aborted).toBe(true);
});
