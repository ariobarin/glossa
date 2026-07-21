import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

if (typeof packageJson.version !== "string") {
  throw new Error("CLI package version is missing");
}

await rm("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  target: "node22.9",
  format: "esm",
  external: ["@napi-rs/keyring"],
  define: {
    __GLOSSA_VERSION__: JSON.stringify(packageJson.version),
  },
});
