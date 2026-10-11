// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { listModels } from "../src/api";
vi.mock("../src/api", () => ({ listModels: vi.fn() }));
const localSet = vi.fn(async () => {});
beforeEach(async () => {
  vi.resetModules();
  vi.mocked(listModels).mockReset();
  localSet.mockClear();
  document.documentElement.innerHTML = readFileSync(
    "public/options.html",
    "utf8",
  );
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async () => ({ config: { model: "saved-model" } }),
        set: localSet,
        remove: async () => {},
        setAccessLevel: async () => {},
      },
      session: {
        get: async () => ({ apiKey: "fixture-key" }),
        set: vi.fn(async () => {}),
        remove: async () => {},
      },
    },
    permissions: { request: vi.fn(async () => true) },
  });
  await import("../src/options");
  await vi.waitFor(() =>
    expect((document.getElementById("model") as HTMLInputElement).value).toBe(
      "saved-model",
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
function input(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}
it("fetches before saving, selects a model, and persists custom effort and translation language", async () => {
  vi.mocked(listModels).mockResolvedValue(["model-a", "model-b"]);
  document.getElementById("fetchModels")!.click();
  await vi.waitFor(() =>
    expect(
      (document.getElementById("modelList") as HTMLSelectElement).options
        .length,
    ).toBe(3),
  );
  expect(localSet).not.toHaveBeenCalled();
  expect(input("model").value).toBe("saved-model");
  const select = document.getElementById("modelList") as HTMLSelectElement;
  select.value = "model-b";
  select.dispatchEvent(new Event("change"));
  input("effort").value = "xhigh";
  input("translationLanguage").value = "Japanese";
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() =>
    expect(localSet).toHaveBeenCalledWith({
      config: expect.objectContaining({
        model: "model-b",
        effort: "xhigh",
        translationLanguage: "Japanese",
      }),
    }),
  );
});
it("discards a model list fetched for an edited Base URL", async () => {
  let finish!: (v: string[]) => void;
  vi.mocked(listModels).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  document.getElementById("fetchModels")!.click();
  await vi.waitFor(() => expect(listModels).toHaveBeenCalledOnce());
  input("baseUrl").value = "https://other.example";
  input("baseUrl").dispatchEvent(new Event("input"));
  finish(["stale-model"]);
  await new Promise((r) => setTimeout(r, 0));
  expect(
    (document.getElementById("modelList") as HTMLSelectElement).disabled,
  ).toBe(true);
  expect(document.getElementById("modelList")!.textContent).not.toContain(
    "stale-model",
  );
});
it("preserves the selected model on a failed refresh", async () => {
  vi.mocked(listModels).mockRejectedValue(new Error("HTTP 401"));
  document.getElementById("fetchModels")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("modelStatus")!.textContent).toContain(
      "HTTP 401",
    ),
  );
  expect(input("model").value).toBe("saved-model");
});

it("shows all effort presets even when medium is selected", () => {
  const select = document.getElementById("effort") as HTMLSelectElement;
  expect(select.tagName).toBe("SELECT");
  select.value = "medium";
  select.dispatchEvent(new Event("change"));
  expect(Array.from(select.options).map((option) => option.value)).toEqual([
    "",
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "__custom",
  ]);
  expect(document.getElementById("customEffortLabel")!.hidden).toBe(true);
});
it("saves custom effort without the UI sentinel and clears it for model default", async () => {
  const select = document.getElementById("effort") as HTMLSelectElement;
  select.value = "__custom";
  select.dispatchEvent(new Event("change"));
  input("customEffort").value = "ultra";
  expect(input("customEffort").disabled).toBe(false);
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() =>
    expect(localSet).toHaveBeenCalledWith({
      config: expect.objectContaining({ effort: "ultra" }),
    }),
  );
  localSet.mockClear();
  select.value = "";
  select.dispatchEvent(new Event("change"));
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() =>
    expect(localSet).toHaveBeenCalledWith({
      config: expect.objectContaining({ effort: "" }),
    }),
  );
  expect(input("customEffort").disabled).toBe(true);
});
it("restores an existing custom effort on settings load", async () => {
  vi.resetModules();
  document.documentElement.innerHTML = readFileSync(
    "public/options.html",
    "utf8",
  );
  chrome.storage.local.get = vi.fn(async () => ({
    config: { model: "saved-model", effort: "ultra" },
  })) as typeof chrome.storage.local.get;
  await import("../src/options");
  await vi.waitFor(() => expect(input("effort").value).toBe("__custom"));
  expect(input("customEffort").value).toBe("ultra");
  expect(input("customEffort").disabled).toBe(false);
});
