import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

await Promise.all(
  [
    "apps/relay/dist",
    "apps/relay/dist-test",
    "packages/cli/dist",
    "packages/cli/dist-test",
    "packages/protocol/dist",
    "packages/protocol/dist-test",
  ].map(
    (directory) => rm(resolve(root, directory), { recursive: true, force: true }),
  ),
);
