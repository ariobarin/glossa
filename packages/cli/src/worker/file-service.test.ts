import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
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

test("applies exact guarded edits and returns a unified diff", async (context) => {
  const root = await temporaryDirectory(context);
  const files = new FileService(await PathPolicy.create(root));
  const original = await files.writeText(
    "note.txt",
    "const alpha = 1;\nbeta\ngamma\n",
  );

  const result = await files.editText(
    "note.txt",
    [
      { oldText: "alpha", newText: "ALPHA" },
      { oldText: "gamma", newText: "G" },
    ],
    original.sha256,
  );

  assert.equal(result.replacements, 2);
  assert.equal(result.diffTruncated, false);
  assert.equal(
    result.diff,
    [
      "--- a/note.txt",
      "+++ b/note.txt",
      "@@ -1,1 +1,1 @@",
      "-const alpha = 1;",
      "+const ALPHA = 1;",
      "@@ -3,1 +3,1 @@",
      "-gamma",
      "+G",
      "",
    ].join("\n"),
  );
  assert.equal(
    await readFile(path.join(root, "note.txt"), "utf8"),
    "const ALPHA = 1;\nbeta\nG\n",
  );
});

test("rejects absent, ambiguous, overlapping, and stale edits", async (context) => {
  const root = await temporaryDirectory(context);
  const files = new FileService(await PathPolicy.create(root));
  const original = await files.writeText("note.txt", "same same abcdef");

  await assert.rejects(
    files.editText("note.txt", [{ oldText: "missing", newText: "x" }]),
    { code: "edit_not_found" },
  );
  await assert.rejects(
    files.editText("note.txt", [{ oldText: "same", newText: "x" }]),
    { code: "edit_ambiguous" },
  );
  await assert.rejects(
    files.editText("note.txt", [
      { oldText: "abcde", newText: "x" },
      { oldText: "cdef", newText: "y" },
    ]),
    { code: "edit_overlap" },
  );
  await assert.rejects(
    files.editText(
      "note.txt",
      [{ oldText: "abcdef", newText: "changed" }],
      "0".repeat(64),
    ),
    { code: "stale_revision" },
  );
  assert.equal(
    await readFile(path.join(root, "note.txt"), "utf8"),
    "same same abcdef",
  );
  assert.equal((await files.readText("note.txt")).sha256, original.sha256);
});

test(
  "preserves executable and regular file modes during edits",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await temporaryDirectory(context);
    const files = new FileService(await PathPolicy.create(root));

    for (const mode of [0o755, 0o644]) {
      const relativePath = `mode-${mode.toString(8)}.txt`;
      const target = path.join(root, relativePath);
      await writeFile(target, "before", "utf8");
      await chmod(target, mode);
      const original = await files.readText(relativePath);

      await files.editText(
        relativePath,
        [{ oldText: "before", newText: "after" }],
        original.sha256,
      );

      assert.equal((await stat(target)).mode & 0o777, mode);
    }
  },
);

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
