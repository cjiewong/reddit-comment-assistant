import {
  requestEndpoint,
  parseDraft,
  prompt,
  type Config,
  type Context,
} from "./shared";
function providerJson(
  text: string,
  url: URL,
  contentType: string,
  status: number,
) {
  const zh =
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("zh");
  const address = url.origin + url.pathname;
  if (
    contentType.toLowerCase().includes("text/html") ||
    /^\s*<(?:!doctype\s+html|html\b)/i.test(text)
  )
    throw new Error(
      zh
        ? `接口返回了 HTML 网页，而非 API 数据（HTTP ${status}）。请求地址：${address}。请检查 API 路径（通常含 /v1）及网关登录／访问限制。`
        : `The API returned an HTML page instead of JSON (HTTP ${status}). Request: ${address}. Check the API path (usually /v1) and gateway login/access restrictions.`,
    );
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new Error(
      zh
        ? `模型接口返回了无效的 JSON 数据（HTTP ${status}）。请求地址：${address}。请检查接口类型和网关配置。`
        : `The provider returned invalid JSON (HTTP ${status}). Request: ${address}. Check the API format and gateway configuration.`,
    );
  }
}
export async function generate(
  config: Config,
  key: string,
  context: Context,
  note: string,
  signal: AbortSignal,
) {
  if (!key || !config.model.trim())
    throw new Error("Set your API key and model in extension settings first.");
  const url = requestEndpoint(config.baseUrl, config.protocol);
  const p = prompt(config, context, note);
  const body =
    config.protocol === "responses"
      ? {
          model: config.model,
          instructions: p.system,
          input: p.user,
          stream: true,
          store: false,
        }
      : {
          model: config.model,
          messages: [
            { role: "system", content: p.system },
            { role: "user", content: p.user },
          ],
          stream: true,
        };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
    redirect: "error",
    credentials: "omit",
  });
  if (!response.ok) {
    const labels: Record<number, string> = {
      401: "Invalid API key",
      403: "Access denied",
      404: "Model or endpoint not found",
      429: "Rate limit or quota exceeded",
    };
    throw new Error(
      `${labels[response.status] || "Provider request failed"} (HTTP ${response.status}).`,
    );
  }
  let raw = "";
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    if (!response.body) throw new Error("Empty response stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    function event(block: string) {
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) return;
      if (data === "[DONE]") {
        finished = true;
        return;
      }
      const item = providerJson(
        data,
        url,
        "text/event-stream",
        response.status,
      );
      if (
        item.error ||
        item.type === "error" ||
        item.type === "response.failed" ||
        item.type === "response.incomplete"
      )
        throw new Error("The provider could not complete the response.");
      if (config.protocol === "responses") {
        if (item.type === "response.output_text.delta") raw += item.delta || "";
        if (item.type === "response.completed") {
          if (item.response?.status && item.response.status !== "completed")
            throw new Error("Incomplete response.");
          finished = true;
        }
      } else {
        const choice = item.choices?.[0];
        raw += choice?.delta?.content || "";
        if (choice?.finish_reason) {
          if (choice.finish_reason !== "stop")
            throw new Error("The model response was truncated or blocked.");
          finished = true;
        }
      }
    }
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer = (buffer + decoder.decode(value, { stream: !done })).replace(
          /\r\n/g,
          "\n",
        );
        let pos;
        while ((pos = buffer.indexOf("\n\n")) >= 0) {
          event(buffer.slice(0, pos));
          buffer = buffer.slice(pos + 2);
        }
        if (buffer.length + raw.length > 200000)
          throw new Error("Response too large.");
        if (done) {
          if (buffer.trim()) event(buffer);
          break;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (!finished)
      throw new Error("The connection closed before generation completed.");
  } else {
    const text = await response.text();
    if (text.length > 200000) throw new Error("Response too large.");
    const data = providerJson(
      text,
      url,
      response.headers.get("content-type") || "",
      response.status,
    );
    if (config.protocol === "responses") {
      if (data.status && data.status !== "completed")
        throw new Error("Incomplete response.");
      raw = (data.output || [])
        .flatMap((x: any) => x.content || [])
        .filter((x: any) => x.type === "output_text")
        .map((x: any) => x.text)
        .join("");
    } else {
      const choice = data.choices?.[0];
      if (choice?.finish_reason && choice.finish_reason !== "stop")
        throw new Error("Incomplete response.");
      raw = choice?.message?.content || "";
    }
  }
  return parseDraft(raw);
}
