import { mkdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("artifacts", { recursive: true });
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const archive = `artifacts/reddit-comment-assistant-${version}.zip`;
await rm(archive, { force: true });
execFileSync("zip", ["-q", "-r", `../${archive}`, "."], { cwd: "dist" });
console.log(archive);
