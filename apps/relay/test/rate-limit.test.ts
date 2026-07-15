import assert from "node:assert/strict";
import test from "node:test";
import { FixedWindowRateLimiter } from "../src/rate-limit.js";

test("rate limits reset after the configured window", () => {
  let now = 1_000;
  const limiter = new FixedWindowRateLimiter(2, 5_000, () => now);

  assert.equal(limiter.consume("client").allowed, true);
  assert.equal(limiter.consume("client").allowed, true);
  const blocked = limiter.consume("client");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 5);

  now += 5_000;
  assert.equal(limiter.consume("client").allowed, true);
});

test("rate limits are isolated by key", () => {
  const limiter = new FixedWindowRateLimiter(1, 5_000);

  assert.equal(limiter.consume("first").allowed, true);
  assert.equal(limiter.consume("first").allowed, false);
  assert.equal(limiter.consume("second").allowed, true);
});
