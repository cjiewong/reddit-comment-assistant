import { defaults, endpoint, type Config } from "./shared";
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
async function load() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  const local = await chrome.storage.local.get(["config", "apiKey"]);
  const session = await chrome.storage.session.get("apiKey");
  const config = { ...defaults, ...local.config };
  for (const key of Object.keys(defaults) as (keyof Config)[])
    if (key === "rememberKey") field(key).checked = config[key];
    else field(key).value = config[key];
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
    config.baseUrl = url.toString().replace(/\/$/, "");
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
    status.textContent = t(
      "Saved. Open a Reddit post and select Generate & fill.",
      "已保存。打开 Reddit 帖子，点击“生成并填入”。",
    );
  } catch (e) {
    status.textContent = (e as Error).message;
  }
};
document.getElementById("clear")!.onclick = async () => {
  await Promise.all([
    chrome.storage.local.remove("apiKey"),
    chrome.storage.session.remove("apiKey"),
  ]);
  field("apiKey").value = "";
  status.textContent = t("API key removed.", "密钥已清除。");
};
