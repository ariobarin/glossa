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
  assert.equal(parseDeviceToken(`gld_${"-".repeat(36)}_${"a".repeat(43)}`), null);
  assert.equal(
    parseDeviceToken("gld_00000000-0000-4000-8000-000000000000_short"),
    null,
  );
});
