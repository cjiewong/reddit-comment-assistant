import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await Promise.all([
  cp("LICENSE", "dist/LICENSE"),
  cp("PRIVACY.md", "dist/PRIVACY.md"),
]);
await Promise.all(
  ["background", "content", "options"].map((name) =>
    build({
      entryPoints: [`src/${name}.ts`],
      outfile: `dist/${name}.js`,
      bundle: true,
      format: name === "background" ? "esm" : "iife",
      target: "chrome120",
      minify: false,
      legalComments: "none",
    }),
  ),
);
