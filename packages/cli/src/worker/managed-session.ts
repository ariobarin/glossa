import type { WorkerJob, WorkerResult } from "@glossa/protocol";
import { type FetchLike, validCredentials } from "../auth-session.js";
import { loadCredentials, type StoredCredentials } from "../config-store.js";
import { announceConnectHint, connectHintStore, shouldShowConnectHint } from "../first-run.js";
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

const visibleActivity = new Set([
  "write_file",
  "edit_file",
  "run_command",
  "cancel_command",
]);

function activityLabel(type: WorkerJob["type"], finished: boolean, ok = true): string {
  if (type === "run_command") {
    return finished
      ? ok
        ? "Command started"
        : "Command rejected"
      : "Command requested";
  }
  if (type === "write_file") {
    return finished
      ? ok
        ? "File write completed"
        : "File write rejected"
      : "File write started";
  }
  if (type === "edit_file") {
    return finished
      ? ok
        ? "File edit completed"
        : "File edit rejected"
      : "File edit started";
  }
  return finished
    ? ok
      ? "Command cancellation completed"
      : "Command cancellation rejected"
    : "Command cancellation requested";
}

export type ManagedSessionEvent =
  | { type: "session"; root: string; deviceName: string }
  | { type: "status"; status: RemoteWorkerStatus }
  | { type: "activity"; phase: "requested"; jobType: WorkerJob["type"]; requestId: string }
  | { type: "activity"; phase: "finished"; jobType: WorkerJob["type"]; requestId: string; ok: boolean }
  | { type: "notice"; message: string };

export interface ManagedSessionOptions {
  signal?: AbortSignal;
  onEvent?: (event: ManagedSessionEvent) => void;
  quiet?: boolean;
  handleProcessSignals?: boolean;
  credentials?: StoredCredentials;
}

function report(
  options: ManagedSessionOptions,
  event: ManagedSessionEvent,
  message: string,
): void {
  options.onEvent?.(event);
  if (!options.quiet) console.error(message);
}

function visibleWorker(worker: LocalWorker, options: ManagedSessionOptions): WorkerHandler {
  return {
    async handle(job: WorkerJob): Promise<WorkerResult> {
      if (visibleActivity.has(job.type)) {
        report(
          options,
          { type: "activity", phase: "requested", jobType: job.type, requestId: job.requestId },
          `${activityLabel(job.type, false)} (${job.requestId}).`,
        );
      }
      const result = await worker.handle(job);
      if (visibleActivity.has(job.type)) {
        report(
          options,
          {
            type: "activity",
            phase: "finished",
            jobType: job.type,
            requestId: job.requestId,
            ok: result.ok,
          },
          `${activityLabel(job.type, true, result.ok)} (${job.requestId}).`,
        );
      }
      return result;
    },
  };
}

export interface ManagedDeviceDependencies {
  credentials?: StoredCredentials;
  loadCredentials?: typeof loadCredentials;
  validCredentials?: typeof validCredentials;
  loadDeviceCredential?: typeof loadDeviceCredential;
  deleteDeviceCredential?: typeof deleteDeviceCredential;
  saveDeviceCredential?: typeof saveDeviceCredential;
  accountOwnsDevice?: typeof accountOwnsDevice;
  enrollDevice?: typeof enrollDevice;
  defaultDeviceName?: typeof defaultDeviceName;
  fetch?: FetchLike;
}

export async function deviceForSession(
  endpoints: RelayEndpoints,
  dependencies: ManagedDeviceDependencies = {},
  signal?: AbortSignal,
): Promise<StoredDeviceCredential> {
  const loadDevice = dependencies.loadDeviceCredential ?? loadDeviceCredential;
  const loadLogin = dependencies.loadCredentials ?? loadCredentials;
  const validate = dependencies.validCredentials ?? validCredentials;
  const removeDevice = dependencies.deleteDeviceCredential ?? deleteDeviceCredential;
  const ownsDevice = dependencies.accountOwnsDevice ?? accountOwnsDevice;
  const enroll = dependencies.enrollDevice ?? enrollDevice;
  const saveDevice = dependencies.saveDeviceCredential ?? saveDeviceCredential;
  const name = dependencies.defaultDeviceName ?? defaultDeviceName;
  const baseFetch = dependencies.fetch ?? fetch;
  const fetchRequest: FetchLike = signal
    ? async (input, init) => await baseFetch(input, { ...init, signal })
    : baseFetch;

  signal?.throwIfAborted();
  const stored = await loadDevice();
  let credentials = dependencies.credentials;
  if (!credentials) {
    const loaded = await loadLogin();
    if (!loaded) throw new Error("Not signed in. Run Glossa again to sign in.");
    credentials = await validate(loaded.credentials, { fetch: fetchRequest });
  }
  signal?.throwIfAborted();
  if (stored?.relayOrigin === endpoints.relayOrigin) {
    if (
      await ownsDevice(
        endpoints,
        credentials,
        stored.deviceId,
        fetchRequest,
      )
    ) {
      return stored;
    }
    await removeDevice();
  }
  const enrolled = await enroll(
    endpoints,
    credentials,
    name(),
    fetchRequest,
  );
  await saveDevice(enrolled);
  return enrolled;
}

function statusMessage(status: RemoteWorkerStatus, previous: RemoteWorkerStatus["state"] | undefined): string {
  if (status.state === "connecting") return "Connecting to Glossa...";
  if (status.state === "connected") {
    return status.reconnected ? "Reconnected to Glossa." : "Connected to Glossa. ChatGPT can now use this workspace.";
  }
  if (status.state === "retrying") {
    const prefix = previous === "connecting" ? "Could not connect" : "Connection lost";
    return `${prefix}: ${status.error.message} Retrying automatically.`;
  }
  return "Disconnected from Glossa.";
}

export async function runManagedSession(
  root: string,
  endpoints: RelayEndpoints,
  options: ManagedSessionOptions = {},
): Promise<void> {
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  const handleProcessSignals = options.handleProcessSignals ?? true;
  let worker: LocalWorker | undefined;

  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", stop, { once: true });
  if (handleProcessSignals) {
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }

  try {
    const device = await deviceForSession(
      endpoints,
      options.credentials ? { credentials: options.credentials } : {},
      controller.signal,
    );
    controller.signal.throwIfAborted();
    worker = await LocalWorker.create(root);
    controller.signal.throwIfAborted();

    report(
      options,
      { type: "session", root: worker.policy.root, deviceName: device.deviceName },
      `Glossa worker root: ${worker.policy.root}`,
    );
    if (!options.quiet) {
      console.error(`Glossa device: ${device.deviceName}`);
      console.error(
        "Files may be modified and commands have the full environment and permissions of this account. Press Ctrl+C to disconnect.",
      );
    }

    let connectionState: RemoteWorkerStatus["state"] | undefined;
    await new RemoteWorker({
      origin: endpoints.workerOrigin,
      deviceToken: device.token,
      worker: visibleWorker(worker, options),
      signal: controller.signal,
      onStatus(status) {
        if (status.state !== "retrying" || connectionState !== "retrying") {
          report(options, { type: "status", status }, statusMessage(status, connectionState));
        } else {
          options.onEvent?.({ type: "status", status });
        }
        if (status.state === "connected" && status.legacyRelay) {
          report(
            options,
            { type: "notice", message: "The relay needs an update before this computer can expose several workspaces at once." },
            "The relay needs an update before this computer can expose several workspaces at once.",
          );
        }
        if (
          status.state === "connected" &&
          !status.reconnected &&
          shouldShowConnectHint(endpoints.relayOrigin)
        ) {
          void announceConnectHint(connectHintStore(), (message) => {
            report(options, { type: "notice", message }, message);
          }).catch(() => undefined);
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
    options.signal?.removeEventListener("abort", stop);
    if (handleProcessSignals) {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
    await worker?.shutdown();
  }
}
