import assert from "node:assert/strict";
import test from "node:test";
import { parseInvocation, UsageError } from "./cli-options.js";

test("keeps bare startup and adds an explicit start command", () => {
  assert.deepEqual(parseInvocation([]), {
    command: "start",
    allowBroadRoot: false,
  });
  assert.deepEqual(parseInvocation(["start", "."]), {
    command: "start",
    path: ".",
    allowBroadRoot: false,
  });
  assert.deepEqual(parseInvocation(["."]), {
    command: "start",
    path: ".",
    allowBroadRoot: false,
  });
});

test("supports conventional option termination for workspace paths", () => {
  assert.deepEqual(parseInvocation(["start", "--", "-workspace"]), {
    command: "start",
    path: "-workspace",
    allowBroadRoot: false,
  });
});

test("keeps login optional and automatic startup separate", () => {
  assert.deepEqual(parseInvocation(["login"]), { command: "login" });
  assert.deepEqual(parseInvocation(["login", "--help"]), {
    command: "help",
    topic: "login",
  });
});

test("rejects unknown commands and ignored status options", () => {
  assert.throws(() => parseInvocation(["frobnicate"]), UsageError);
  assert.throws(() => parseInvocation(["status", "--bogus"]), UsageError);
  assert.deepEqual(parseInvocation(["status", "--json"]), {
    command: "status",
    json: true,
  });
});

test("validates device management arguments", () => {
  assert.deepEqual(parseInvocation(["devices", "revoke", "device-id"]), {
    command: "devices",
    action: "revoke",
    deviceId: "device-id",
  });
  assert.throws(() => parseInvocation(["devices", "rename", "device-id"]), UsageError);
});
