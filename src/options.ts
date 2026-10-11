import { defaults, endpoint, requestEndpoint, type Config } from "./shared";
import { listModels } from "./api";
const zh = navigator.language.toLowerCase().startsWith("zh");
const t = (en: string, cn: string) => (zh ? cn : en);
document.documentElement.lang = zh ? "zh-CN" : "en";
for (const el of document.querySelectorAll<HTMLElement>("[data-en]"))
  el.textContent = (zh ? el.dataset.zh : el.dataset.en) || "";
for (const el of document.querySelectorAll<HTMLElement>("[data-label-en]"))
  el.prepend(
    document.createTextNode(
      (zh ? el.dataset.labelZh : el.dataset.labelEn) || "",
    ),
  );
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const status = document.getElementById("status")!;
const effort = document.getElementById("effort") as HTMLSelectElement;
const customEffort = field("customEffort");
function syncEffort() {
  const custom = effort.value === "__custom";
  document.getElementById("customEffortLabel")!.hidden = !custom;
  customEffort.disabled = !custom;
  customEffort.required = custom;
}
effort.onchange = syncEffort;
const modelList = document.getElementById("modelList") as HTMLSelectElement;
const fetchButton = document.getElementById("fetchModels") as HTMLButtonElement;
const modelStatus = document.getElementById("modelStatus")!;
let modelRequest: AbortController | undefined;
function resetModels() {
  modelRequest?.abort();
  modelRequest = undefined;
  fetchButton.disabled = false;
  modelList.replaceChildren(
    new Option(t("Fetch models to choose", "拉取模型后选择"), ""),
  );
  modelList.disabled = true;
  modelStatus.textContent = "";
}
for (const name of ["baseUrl", "apiKey"])
  field(name).addEventListener("input", resetModels);
modelList.onchange = () => {
  if (modelList.value) field("model").value = modelList.value;
};
field("model").addEventListener("input", () => {
  modelList.value = field("model").value;
});
fetchButton.onclick = async () => {
  resetModels();
  const request = new AbortController();
  modelRequest = request;
  const base = field("baseUrl").value;
  const key = field("apiKey").value.trim();
  fetchButton.disabled = true;
  modelStatus.textContent = t("Fetching models…", "正在拉取模型…");
  try {
    if (!key)
      throw new Error(t("Enter your API key first.", "请先填写 API Key。"));
    const url = endpoint(base);
    const allowed = await chrome.permissions.request({
      origins: [url.origin + "/*"],
    });
    if (request.signal.aborted) return;
    if (!allowed)
      throw new Error(t("API access was not granted.", "未授予接口访问权限。"));
    const models = await listModels(
      base,
      key,
      AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    );
    if (modelRequest !== request) return;
    modelList.replaceChildren(
      new Option(t("Select a model", "请选择模型"), ""),
      ...models.map((id) => new Option(id, id)),
    );
    modelList.disabled = !models.length;
    modelList.value = field("model").value;
    modelStatus.textContent = models.length
      ? t(
          `Loaded ${models.length} models. Select one and save.`,
          `已获取 ${models.length} 个模型，选择后保存设置。`,
        )
      : t(
          "No models returned. You can enter a model ID manually.",
          "服务未返回可用模型，可手动填写模型名称。",
        );
  } catch (e) {
    if (modelRequest === request)
      modelStatus.textContent =
        (e as Error).name === "TimeoutError"
          ? t("Model request timed out.", "拉取模型超时，请重试。")
          : (e as Error).message;
  } finally {
    if (modelRequest === request) {
      modelRequest = undefined;
      fetchButton.disabled = false;
    }
  }
};
async function load() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  const local = await chrome.storage.local.get(["config", "apiKey"]);
  const session = await chrome.storage.session.get("apiKey");
  const config = { ...defaults, ...local.config };
  for (const key of Object.keys(defaults) as (keyof Config)[])
    if (key === "rememberKey") field(key).checked = config[key];
    else if (key === "effort") {
      const preset = Array.from(effort.options).some(
        (option) =>
          option.value !== "__custom" && option.value === config.effort,
      );
      effort.value = preset ? config.effort : "__custom";
      customEffort.value = preset ? "" : config.effort;
      syncEffort();
    } else field(key).value = config[key];
  field("apiKey").value =
    (config.rememberKey ? local.apiKey : session.apiKey) || "";
}
load().catch(
  () => (status.textContent = t("Could not load settings.", "无法加载设置。")),
);
document.getElementById("settings")!.onsubmit = async (event) => {
  event.preventDefault();
  try {
    const url = endpoint(field("baseUrl").value);
    const config: Config = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof Config)[])
      if (key === "rememberKey") config[key] = field(key).checked;
      else (config as any)[key] = field(key).value.trim();
    if (effort.value === "__custom") {
      config.effort = customEffort.value.trim();
      if (!config.effort)
        throw new Error(
          t(
            "Enter a custom effort value or choose Model default.",
            "请填写自定义 effort，或选择模型默认。",
          ),
        );
    }
    config.baseUrl = url.toString().replace(/\/$/, "");
    requestEndpoint(config.baseUrl, config.protocol);
    const granted = await chrome.permissions.request({
      origins: [url.origin + "/*"],
    });
    if (!granted)
      throw new Error(
        t(
          "API access was not granted. Settings were not saved.",
          "接口访问权限未授予，设置尚未保存。",
        ),
      );
    await chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS",
    });
    const key = field("apiKey").value.trim();
    await chrome.storage.local.set({ config });
    if (config.rememberKey) {
      await chrome.storage.local.set({ apiKey: key });
      await chrome.storage.session.remove("apiKey");
    } else {
      await chrome.storage.session.set({ apiKey: key });
      await chrome.storage.local.remove("apiKey");
    }
    field("baseUrl").value = config.baseUrl;
    status.textContent = t(
      "Saved. Open a Reddit post and select Generate & fill.",
      "已保存。打开 Reddit 帖子，点击“生成并填入”。",
    );
  } catch (e) {
    status.textContent = (e as Error).message;
  }
};
document.getElementById("clear")!.onclick = async () => {
  resetModels();
  await Promise.all([
    chrome.storage.local.remove("apiKey"),
    chrome.storage.session.remove("apiKey"),
  ]);
  field("apiKey").value = "";
  status.textContent = t("API key removed.", "密钥已清除。");
};
