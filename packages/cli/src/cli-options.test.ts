import assert from "node:assert/strict";
import test from "node:test";
import { parseInvocation, UsageError } from "./cli-options.js";

test("keeps bare startup and adds an explicit start command", () => {
  assert.deepEqual(parseInvocation([]), { command: "start", allowBroadRoot: false });
  assert.deepEqual(parseInvocation(["start", "."]), { command: "start", path: ".", allowBroadRoot: false });
  assert.deepEqual(parseInvocation(["."]), { command: "start", path: ".", allowBroadRoot: false });
});

test("supports conventional option termination for workspace paths", () => {
  assert.deepEqual(parseInvocation(["start", "--", "-workspace"]), { command: "start", path: "-workspace", allowBroadRoot: false });
  assert.deepEqual(parseInvocation(["--allow-broad-root"]), { command: "start", allowBroadRoot: true });
});

test("keeps login optional and automatic startup separate", () => {
  assert.deepEqual(parseInvocation(["login"]), { command: "login" });
  assert.deepEqual(parseInvocation(["login", "--help"]), { command: "help", topic: "login" });
});

test("rejects unknown commands and ignored status options", () => {
  assert.throws(() => parseInvocation(["frobnicate"]), UsageError);
  assert.throws(() => parseInvocation(["status", "--bogus"]), UsageError);
  assert.deepEqual(parseInvocation(["status", "--json"]), { command: "status", json: true });
});

test("validates device management arguments", () => {
  assert.deepEqual(parseInvocation(["devices", "revoke", "device-id"]), { command: "devices", action: "revoke", deviceId: "device-id" });
  assert.throws(() => parseInvocation(["devices", "rename", "device-id"]), UsageError);
});

test("adds an opt-in interactive UI without changing bare startup", () => {
  assert.deepEqual(parseInvocation(["ui"]), {
    command: "ui",
    allowBroadRoot: false,
  });
  assert.deepEqual(parseInvocation(["ui", ".", "--allow-broad-root"]), {
    command: "ui",
    path: ".",
    allowBroadRoot: true,
  });
  assert.deepEqual(parseInvocation(["ui", "--help"]), {
    command: "help",
    topic: "ui",
  });
});


test("parses a device name for workspace sessions and trims whitespace", () => {
  assert.deepEqual(parseInvocation(["start", "--device-name", "  Laptop  "]), {
    command: "start",
    allowBroadRoot: false,
    deviceName: "Laptop",
  });
  assert.deepEqual(parseInvocation(["ui", "--device-name=Build PC"]), {
    command: "ui",
    allowBroadRoot: false,
    deviceName: "Build PC",
  });
  assert.deepEqual(parseInvocation(["--device-name", "Desk", "."]), {
    command: "start",
    path: ".",
    allowBroadRoot: false,
    deviceName: "Desk",
  });
});

test("rejects a missing or invalid device name", () => {
  assert.throws(() => parseInvocation(["start", "--device-name"]), UsageError);
  assert.throws(
    () => parseInvocation(["ui", "--device-name", "--allow-broad-root"]),
    UsageError,
  );
  assert.throws(() => parseInvocation(["start", "--device-name", ""]), UsageError);
  assert.throws(
    () => parseInvocation(["start", "--device-name", "x".repeat(81)]),
    UsageError,
  );
});
