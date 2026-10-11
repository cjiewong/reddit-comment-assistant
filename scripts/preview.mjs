// UI-only preview. Uses a fake extension API; it never calls a model provider.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const mock = `const data={};globalThis.chrome={storage:{local:{get:async()=>data,set:async v=>Object.assign(data,v),remove:async k=>delete data[k],setAccessLevel:async()=>{}},session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},permissions:{request:async()=>true}};`;
const allowed = new Set(["/options.html", "/options.css", "/options.js"]);
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/v1/models") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          data: [{ id: "fixture-model-a" }, { id: "fixture-model-b" }],
        }),
      );
      return;
    }
    if (path === "/mock.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(mock);
      return;
    }
    if (path === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><title>Settings UI verification</title><style>body{margin:20px;background:#e1e6ea;display:flex;gap:20px;align-items:flex-start}iframe{border:0;height:1200px;background:white}</style><iframe title="Desktop settings" src="/options.html" width="760"></iframe><iframe title="Mobile settings" src="/options.html" width="390"></iframe>',
      );
      return;
    }
    if (!allowed.has(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = await readFile("dist" + path, "utf8");
    if (path.endsWith(".html"))
      body = body.replace("<head>", '<head><script src="/mock.js"></script>');
    res.setHeader(
      "Content-Type",
      path.endsWith(".html")
        ? "text/html"
        : path.endsWith(".css")
          ? "text/css"
          : "application/javascript",
    );
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("Build the extension first.");
  }
});
server.listen(0, "127.0.0.1", () =>
  console.log(`UI preview: http://127.0.0.1:${server.address().port}`),
);
