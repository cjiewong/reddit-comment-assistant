import {
  endpoint,
  parseDraft,
  prompt,
  type Config,
  type Context,
} from "./shared";
export async function generate(
  config: Config,
  key: string,
  context: Context,
  note: string,
  signal: AbortSignal,
) {
  if (!key || !config.model.trim())
    throw new Error("Set your API key and model in extension settings first.");
  const url = endpoint(config.baseUrl);
  url.pathname +=
    "/" + (config.protocol === "responses" ? "responses" : "chat/completions");
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
      const item = JSON.parse(data);
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
    const data = JSON.parse(text);
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
