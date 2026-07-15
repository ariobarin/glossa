import assert from "node:assert/strict";
import test from "node:test";
import { add, multiply } from "../src/math.js";

test("adds two numbers", () => {
  assert.equal(add(2, 3), 5);
});

test("multiplies two numbers", () => {
  assert.equal(multiply(4, 5), 20);
});
