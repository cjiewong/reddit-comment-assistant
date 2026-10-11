import { defaults, endpoint, type Config } from "./shared";
import { generate } from "./api";
const ready = Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
]);
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "settings" && sender.id === chrome.runtime.id) {
    chrome.runtime.openOptionsPage();
    reply({ ok: true });
  }
});
chrome.runtime.onConnect.addListener((port) => {
  if (
    port.name !== "generate" ||
    port.sender?.id !== chrome.runtime.id ||
    !port.sender.url?.startsWith("https://www.reddit.com/")
  ) {
    port.disconnect();
    return;
  }
  let controller: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  const send = (value: unknown) => {
    try {
      port.postMessage(value);
    } catch {}
  };
  port.onDisconnect.addListener(() => {
    controller?.abort();
    clearTimeout(timeout);
  });
  port.onMessage.addListener(async (msg) => {
    if (msg?.type === "cancel") {
      controller?.abort();
      return;
    }
    if (msg?.type === "ping") {
      send({ type: "pong" });
      return;
    }
    if (msg?.type !== "generate" || busy) return;
    busy = true;
    controller = new AbortController();
    timeout = setTimeout(() => controller?.abort(), 120000);
    try {
      await ready;
      const local = await chrome.storage.local.get(["config", "apiKey"]);
      const session = await chrome.storage.session.get("apiKey");
      const config: Config = { ...defaults, ...local.config };
      const origin = endpoint(config.baseUrl).origin + "/*";
      if (!(await chrome.permissions.contains({ origins: [origin] })))
        throw new Error("Grant API access in extension settings.");
      if (
        !msg.context ||
        typeof msg.context.title !== "string" ||
        typeof msg.context.body !== "string" ||
        typeof msg.context.community !== "string" ||
        !Array.isArray(msg.context.parents) ||
        !msg.context.parents.every((v: unknown) => typeof v === "string") ||
        typeof msg.note !== "string"
      )
        throw new Error("Invalid Reddit context.");
      const draft = await generate(
        config,
        config.rememberKey ? local.apiKey : session.apiKey,
        msg.context,
        msg.note,
        controller.signal,
      );
      send({ type: "result", draft });
    } catch (error) {
      send({
        type: "error",
        error: controller.signal.aborted
          ? "Generation cancelled or timed out."
          : error instanceof Error
            ? error.message
            : "Generation failed.",
      });
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  });
});
