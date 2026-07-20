import type { WorkerJob, WorkerResult } from "@glossa/protocol";
import { validCredentials } from "../auth-session.js";
import { loadCredentials } from "../config-store.js";
import {
  deleteDeviceCredential,
  loadDeviceCredential,
  saveDeviceCredential,
  type StoredDeviceCredential,
} from "../device-store.js";
import {
  accountOwnsDevice,
  defaultDeviceName,
  enrollDevice,
  type RelayEndpoints,
} from "../relay-client.js";
import { LocalWorker } from "./local-worker.js";
import {
  DeviceRejectedError,
  RemoteWorker,
  type WorkerHandler,
  type RemoteWorkerStatus,
} from "./remote-worker.js";

const visibleActivity = new Set(["write_file", "run_command", "cancel_command"]);

function activityLabel(type: WorkerJob["type"], finished: boolean, ok = true): string {
  if (type === "run_command") return finished ? (ok ? "Command started" : "Command rejected") : "Command requested";
  if (type === "write_file") return finished ? (ok ? "File write completed" : "File write rejected") : "File write started";
  return finished ? (ok ? "Command cancellation completed" : "Command cancellation rejected") : "Command cancellation requested";
}

function visibleWorker(worker: LocalWorker): WorkerHandler {
  return {
    async handle(job: WorkerJob): Promise<WorkerResult> {
      if (visibleActivity.has(job.type)) {
        console.error(`${activityLabel(job.type, false)} (${job.requestId}).`);
      }
      const result = await worker.handle(job);
      if (visibleActivity.has(job.type)) {
        console.error(
          `${activityLabel(job.type, true, result.ok)} (${job.requestId}).`,
        );
      }
      return result;
    },
  };
}

export interface ManagedDeviceDependencies {
  loadCredentials?: typeof loadCredentials;
  validCredentials?: typeof validCredentials;
  loadDeviceCredential?: typeof loadDeviceCredential;
  deleteDeviceCredential?: typeof deleteDeviceCredential;
  saveDeviceCredential?: typeof saveDeviceCredential;
  accountOwnsDevice?: typeof accountOwnsDevice;
  enrollDevice?: typeof enrollDevice;
  defaultDeviceName?: typeof defaultDeviceName;
}

export async function deviceForSession(
  endpoints: RelayEndpoints,
  dependencies: ManagedDeviceDependencies = {},
): Promise<StoredDeviceCredential> {
  const loadDevice = dependencies.loadDeviceCredential ?? loadDeviceCredential;
  const loadLogin = dependencies.loadCredentials ?? loadCredentials;
  const validate = dependencies.validCredentials ?? validCredentials;
  const removeDevice = dependencies.deleteDeviceCredential ?? deleteDeviceCredential;
  const ownsDevice = dependencies.accountOwnsDevice ?? accountOwnsDevice;
  const enroll = dependencies.enrollDevice ?? enrollDevice;
  const saveDevice = dependencies.saveDeviceCredential ?? saveDeviceCredential;
  const name = dependencies.defaultDeviceName ?? defaultDeviceName;
  const stored = await loadDevice();
  const loaded = await loadLogin();
  if (!loaded) throw new Error("Not signed in. Run Glossa again to sign in.");
  const credentials = await validate(loaded.credentials);
  if (stored?.relayOrigin === endpoints.relayOrigin) {
    if (await ownsDevice(endpoints, credentials, stored.deviceId)) return stored;
    await removeDevice();
  }
  const enrolled = await enroll(
    endpoints,
    credentials,
    name(),
  );
  await saveDevice(enrolled);
  return enrolled;
}

export async function runManagedSession(
  root: string,
  endpoints: RelayEndpoints,
  allowBroadRoot = false,
): Promise<void> {
  const device = await deviceForSession(endpoints);
  const worker = await LocalWorker.create(root, allowBroadRoot);
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.error(`Glossa worker root: ${worker.policy.root}`);
  console.error(`Glossa device: ${device.deviceName}`);
  console.error(
    "Files may be modified and commands have the full environment and permissions of this account. Press Ctrl+C to disconnect.",
  );
  let connectionState: RemoteWorkerStatus["state"] | undefined;
  try {
    await new RemoteWorker({
      origin: endpoints.workerOrigin,
      deviceToken: device.token,
      worker: visibleWorker(worker),
      signal: controller.signal,
      onStatus(status) {
        if (status.state === "connecting") {
          console.error("Connecting to Glossa...");
        } else if (status.state === "connected") {
          console.error(status.reconnected ? "Reconnected to Glossa." : "Connected to Glossa. ChatGPT can now use this workspace.");
        } else if (status.state === "retrying" && connectionState !== "retrying") {
          const prefix = connectionState === "connecting" ? "Could not connect" : "Connection lost";
          console.error(`${prefix}: ${status.error.message} Retrying automatically.`);
        } else if (status.state === "disconnected") {
          console.error("Disconnected from Glossa.");
        }
        connectionState = status.state;
      },
    }).run();
  } catch (error) {
    if (error instanceof DeviceRejectedError) {
      await deleteDeviceCredential();
      throw new Error("The relay rejected this device. Run Glossa again to reenroll it.");
    }
    throw error;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await worker.shutdown();
  }
}
