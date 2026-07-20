import assert from "node:assert/strict";
import test from "node:test";
import { FixedWindowRateLimiter } from "./rate-limit.js";

test("checks failure limits without charging valid traffic", () => {
  let now = 1_000;
  const limiter = new FixedWindowRateLimiter(2, 60_000, () => now);

  assert.equal(limiter.check("device").allowed, true);
  assert.equal(limiter.check("device").allowed, true);
  assert.equal(limiter.consume("device").allowed, true);
  assert.equal(limiter.consume("device").allowed, true);
  assert.equal(limiter.check("device").allowed, true);
  assert.equal(limiter.consume("device").allowed, false);
  assert.equal(limiter.check("device").allowed, false);

  now += 60_000;
  assert.equal(limiter.check("device").allowed, true);
});
