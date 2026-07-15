import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

if (typeof packageJson.version !== "string") {
  throw new Error("CLI package version is missing");
}

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["@napi-rs/keyring"],
  sourcemap: true,
  define: {
    __GLOSSA_VERSION__: JSON.stringify(packageJson.version),
  },
});
