import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDoctorResult,
  nodeVersionSatisfies,
  runDoctorChecks,
  type DoctorDependencies,
} from "./doctor.js";

test("node version check accepts the minimum and newer", () => {
  assert.equal(nodeVersionSatisfies("22.9.0"), true);
  assert.equal(nodeVersionSatisfies("22.9.1"), true);
  assert.equal(nodeVersionSatisfies("23.0.0"), true);
  assert.equal(nodeVersionSatisfies("24.13.0"), true);
  assert.equal(nodeVersionSatisfies("v22.9.0"), true);
});

test("node version check rejects older and malformed versions", () => {
  assert.equal(nodeVersionSatisfies("22.8.0"), false);
  assert.equal(nodeVersionSatisfies("21.7.0"), false);
  assert.equal(nodeVersionSatisfies("garbage"), false);
  assert.equal(nodeVersionSatisfies(""), false);
});

const healthy: DoctorDependencies = {
  nodeVersion: "24.13.0",
  endpoints: {
    relayOrigin: "https://mcp.glossa.test",
    workerOrigin: "https://mcp.glossa.test",
  },
  checkGit: async () => true,
  fetchHealthz: async () => true,
  hasCredentials: async () => true,
};

test("reports a ready machine with every check passing", async () => {
  const checks = await runDoctorChecks(healthy);
  assert.equal(checks.every((c) => c.status === "pass"), true);
  assert.deepEqual(
    checks.map((c) => c.name),
    ["Node.js", "Git", "Relay", "Sign-in"],
  );
});

test("fails on missing git and unreachable relay", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    checkGit: async () => false,
    fetchHealthz: async () => false,
  });
  const git = checks.find((c) => c.name === "Git");
  const relay = checks.find((c) => c.name === "Relay");
  assert.equal(git?.status, "fail");
  assert.ok(git?.nextStep);
  assert.equal(relay?.status, "fail");
  assert.ok(relay?.detail.includes("not reachable"));
});

test("warns instead of failing when not signed in yet", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    hasCredentials: async () => false,
  });
  const signIn = checks.find((c) => c.name === "Sign-in");
  assert.equal(signIn?.status, "warn");
  assert.ok(signIn?.nextStep);
});

test("fails the node check below the supported version", async () => {
  const checks = await runDoctorChecks({ ...healthy, nodeVersion: "22.8.0" });
  const node = checks.find((c) => c.name === "Node.js");
  assert.equal(node?.status, "fail");
});

test("text output summarizes readiness and json output is structured", () => {
  const checks = [
    { name: "Node.js", status: "pass" as const, detail: "Node.js v24.13.0" },
    {
      name: "Sign-in",
      status: "warn" as const,
      detail: "Not signed in yet.",
      nextStep: "Run glossa.",
    },
  ];
  const text = formatDoctorResult(checks, false);
  assert.match(text, /PASS.*Node\.js v24\.13\.0/);
  assert.match(text, /WARN.*Not signed in yet\./);
  assert.match(text, /Run glossa\./);
  assert.match(text, /Glossa is ready to start\./);

  const json = JSON.parse(formatDoctorResult(checks, true));
  assert.deepEqual(json.checks, checks);
});

test("text output counts failures", () => {
  const failing = [
    {
      name: "Git",
      status: "fail" as const,
      detail: "Git was not found.",
      nextStep: "Install Git.",
    },
  ];
  assert.match(formatDoctorResult(failing, false), /1 check failed/);
  assert.match(
    formatDoctorResult(
      [...failing, { name: "Relay", status: "fail" as const, detail: "down" }],
      false,
    ),
    /2 checks failed/,
  );
});
