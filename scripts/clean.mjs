import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

await Promise.all(
  ["apps/relay/dist", "packages/cli/dist", "packages/protocol/dist"].map(
    (directory) => rm(resolve(root, directory), { recursive: true, force: true }),
  ),
);
