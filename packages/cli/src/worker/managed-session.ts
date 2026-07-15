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
  defaultDeviceName,
  enrollDevice,
  type RelayEndpoints,
} from "../relay-client.js";
import { LocalWorker } from "./local-worker.js";
import {
  DeviceRejectedError,
  RemoteWorker,
  type WorkerHandler,
} from "./remote-worker.js";

const visibleActivity = new Set(["write_file", "run_command", "cancel_command"]);

function visibleWorker(worker: LocalWorker): WorkerHandler {
  return {
    async handle(job: WorkerJob): Promise<WorkerResult> {
      if (visibleActivity.has(job.type)) {
        console.error(`Activity started: ${job.type} (${job.requestId})`);
      }
      const result = await worker.handle(job);
      if (visibleActivity.has(job.type)) {
        console.error(
          `Activity finished: ${job.type} (${job.requestId}), ${result.ok ? "accepted" : "rejected"}`,
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
  saveDeviceCredential?: typeof saveDeviceCredential;
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
  const enroll = dependencies.enrollDevice ?? enrollDevice;
  const saveDevice = dependencies.saveDeviceCredential ?? saveDeviceCredential;
  const name = dependencies.defaultDeviceName ?? defaultDeviceName;
  const stored = await loadDevice();
  if (stored?.relayOrigin === endpoints.relayOrigin) return stored;

  const loaded = await loadLogin();
  if (!loaded) throw new Error("Not signed in. Run Glossa again to sign in.");
  const credentials = await validate(loaded.credentials);
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
  try {
    await new RemoteWorker({
      origin: endpoints.workerOrigin,
      deviceToken: device.token,
      worker: visibleWorker(worker),
      signal: controller.signal,
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
