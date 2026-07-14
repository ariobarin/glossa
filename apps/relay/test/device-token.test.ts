import assert from "node:assert/strict";
import test from "node:test";
import {
  generateDeviceToken,
  parseDeviceToken,
  verifyDeviceSecret,
} from "../src/device-token.js";

test("generated device tokens verify without storing the plaintext", async () => {
  const generated = await generateDeviceToken();
  const parsed = parseDeviceToken(generated.token);
  assert.ok(parsed);
  assert.equal(parsed.deviceId, generated.deviceId);
  assert.equal(
    await verifyDeviceSecret(parsed.secret, generated.salt, generated.hash),
    true,
  );
  assert.equal(
    await verifyDeviceSecret(`${parsed.secret}x`, generated.salt, generated.hash),
    false,
  );
});

test("malformed tokens are rejected", () => {
  assert.equal(parseDeviceToken("not-a-device-token"), null);
});
