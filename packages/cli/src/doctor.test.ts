import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDoctorResult,
  nodeVersionSatisfies,
  runDoctor,
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
  fetchHealthz: async () => true,
  probeCredentials: async () => "present" as const,
  probeDeviceCredential: async () => "present" as const,
};

test("reports a ready machine with every check passing", async () => {
  const checks = await runDoctorChecks(healthy);
  assert.equal(checks.every((c) => c.status === "pass"), true);
  assert.deepEqual(
    checks.map((c) => c.name),
    ["Node.js", "Relay", "Sign-in", "Device"],
  );
});

test("reports a self-contained runtime without requiring Node.js", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    standalone: true,
    nodeVersion: "1.0.0",
    probeStandaloneRuntime: async () => true,
  });
  assert.deepEqual(checks[0], {
    name: "Runtime",
    status: "pass",
    detail: "Self-contained Glossa executable.",
  });
  assert.equal(checks.some((check) => check.name === "Node.js"), false);
});

test("fails a standalone runtime missing its native credential module", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    standalone: true,
    probeStandaloneRuntime: async () => false,
  });
  assert.deepEqual(checks[0], {
    name: "Runtime",
    status: "fail",
    detail: "The executable is missing its native credential module.",
    nextStep: "Reinstall Glossa with npm or the direct installer.",
  });
});

test("fails on an unreachable relay", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    fetchHealthz: async () => false,
  });
  const relay = checks.find((c) => c.name === "Relay");
  assert.equal(relay?.status, "fail");
  assert.ok(relay?.detail.includes("not reachable"));
});

test("fails when a separate worker endpoint is unreachable", async () => {
  const checkedOrigins: string[] = [];
  const checks = await runDoctorChecks({
    ...healthy,
    endpoints: {
      relayOrigin: "https://relay.glossa.test",
      workerOrigin: "https://worker.glossa.test",
    },
    fetchHealthz: async (origin) => {
      checkedOrigins.push(origin);
      return origin !== "https://worker.glossa.test";
    },
  });
  assert.deepEqual(checkedOrigins, [
    "https://relay.glossa.test",
    "https://worker.glossa.test",
  ]);
  const worker = checks.find((c) => c.name === "Worker");
  assert.equal(worker?.status, "fail");
  assert.match(worker?.nextStep ?? "", /GLOSSA_WORKER_ORIGIN/);
});

test("reports malformed endpoint configuration as a structured failure", async () => {
  const checks = await runDoctorChecks({
    nodeVersion: "24.13.0",
    loadEndpoints: () => {
      throw new Error("GLOSSA_RELAY_ORIGIN must contain only an origin.");
    },
    probeCredentials: async () => "present" as const,
    probeDeviceCredential: async () => "present" as const,
  });
  const relay = checks.find((c) => c.name === "Relay");
  assert.equal(relay?.status, "fail");
  assert.match(relay?.detail ?? "", /GLOSSA_RELAY_ORIGIN/);
  assert.match(relay?.nextStep ?? "", /without paths/);

  const json = JSON.parse(formatDoctorResult(checks, true));
  assert.equal(json.checks.find((check: { name: string }) => check.name === "Relay").status, "fail");
  assert.equal(await runDoctor(true, {
    nodeVersion: "24.13.0",
    loadEndpoints: () => {
      throw new Error("bad origin");
    },
    probeCredentials: async () => "present" as const,
    probeDeviceCredential: async () => "present" as const,
  }, () => undefined), false);
});

test("warns instead of failing when not signed in yet", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    probeCredentials: async () => "absent" as const,
  });
  const signIn = checks.find((c) => c.name === "Sign-in");
  assert.equal(signIn?.status, "warn");
  assert.ok(signIn?.nextStep);
});

test("fails the sign-in check when stored credentials are unreadable", async () => {
  const deps = { ...healthy, probeCredentials: async () => "error" as const };
  const checks = await runDoctorChecks(deps);
  const signIn = checks.find((c) => c.name === "Sign-in");
  assert.equal(signIn?.status, "fail");
  assert.match(signIn?.nextStep ?? "", /glossa logout/);
  const ok = await runDoctor(false, deps, () => undefined);
  assert.equal(ok, false);
});

test("warns when this computer has not enrolled a device yet", async () => {
  const checks = await runDoctorChecks({
    ...healthy,
    probeDeviceCredential: async () => "absent" as const,
  });
  const device = checks.find((c) => c.name === "Device");
  assert.equal(device?.status, "warn");
  assert.match(device?.nextStep ?? "", /device-name/);
  assert.equal(await runDoctor(false, {
    ...healthy,
    probeDeviceCredential: async () => "absent" as const,
  }, () => undefined), true);
});

test("fails when stored device credentials are unreadable", async () => {
  const deps = {
    ...healthy,
    probeDeviceCredential: async () => "error" as const,
  };
  const checks = await runDoctorChecks(deps);
  const device = checks.find((c) => c.name === "Device");
  assert.equal(device?.status, "fail");
  assert.match(device?.detail ?? "", /unreadable/);
  assert.match(device?.nextStep ?? "", /device\.json|credential store/);
  assert.equal(await runDoctor(false, deps, () => undefined), false);
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
