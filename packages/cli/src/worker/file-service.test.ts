import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileService } from "./file-service.js";
import { PathPolicy, validateRelativePath } from "./path-policy.js";

async function temporaryDirectory(context: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glossa-test-"));
  context.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });
  return directory;
}

test("rejects Windows absolute and parent paths", () => {
  assert.throws(() => validateRelativePath("C:\\Windows\\win.ini"), {
    code: "absolute_path",
  });
  assert.throws(() => validateRelativePath("..\\outside.txt"), {
    code: "path_traversal",
  });
  assert.equal(validateRelativePath("src\\index.ts"), "src\\index.ts");
});

test("blocks Windows junction traversal", async (context) => {
  const fixture = await temporaryDirectory(context);
  const root = path.join(fixture, "root");
  const outside = path.join(fixture, "outside");
  await mkdir(root);
  await mkdir(outside);
  await writeFile(path.join(outside, "secret.txt"), "outside", "utf8");
  await symlink(outside, path.join(root, "linked"), "junction");

  const policy = await PathPolicy.create(root);
  await assert.rejects(policy.resolveExisting("linked\\secret.txt"), {
    code: "linked_path",
  });
});

test("lists one directory without following junctions", async (context) => {
  const fixture = await temporaryDirectory(context);
  const root = path.join(fixture, "root");
  const outside = path.join(fixture, "outside");
  await mkdir(path.join(root, "nested"), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, "README.md"), "hello", "utf8");
  await writeFile(path.join(root, "nested", "hidden.txt"), "nested", "utf8");
  await symlink(outside, path.join(root, "linked"), "junction");

  const files = new FileService(await PathPolicy.create(root));
  const result = await files.list(".");

  assert.deepEqual(result, {
    entries: [
      { name: "linked", type: "other" },
      { name: "nested", type: "directory" },
      { name: "README.md", type: "file" },
    ],
    truncated: false,
  });
  assert.equal(result.entries.some((entry) => entry.name === "hidden.txt"), false);
});

test("writes atomically and rejects stale revisions", async (context) => {
  const root = await temporaryDirectory(context);
  const files = new FileService(await PathPolicy.create(root));

  const first = await files.writeText("note.txt", "first");
  assert.equal(first.bytes, 5);
  assert.deepEqual(await files.readText("note.txt"), {
    content: "first",
    sha256: first.sha256,
    bytes: 5,
  });

  await assert.rejects(
    files.writeText("note.txt", "second", "0".repeat(64)),
    { code: "stale_revision" },
  );
  assert.equal(await readFile(path.join(root, "note.txt"), "utf8"), "first");

  const second = await files.writeText("note.txt", "second", first.sha256);
  assert.equal(second.bytes, 6);
  assert.equal(await readFile(path.join(root, "note.txt"), "utf8"), "second");
});
