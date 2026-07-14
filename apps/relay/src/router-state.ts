import { randomUUID } from "node:crypto";
import type { WorkerJob, WorkerResult } from "@glossa/protocol";

interface ConnectedDevice {
  accountId: string;
  deviceId: string;
  generation: string;
  pendingJobs: WorkerJob[];
  pollWaiter?: (job: WorkerJob | null) => void;
}

interface ResultWaiter {
  accountId: string;
  deviceId: string;
  resolve: (result: WorkerResult) => void;
  reject: (error: Error) => void;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

interface RoutedResource {
  accountId: string;
  deviceId: string;
}

export class RouterState {
  readonly #devices = new Map<string, ConnectedDevice>();
  readonly #results = new Map<string, ResultWaiter>();
  readonly #workspaces = new Map<string, RoutedResource>();
  readonly #commands = new Map<string, RoutedResource>();

  register(accountId: string, deviceId: string): string {
    const generation = randomUUID();
    const previous = this.#devices.get(deviceId);
    previous?.pollWaiter?.(null);
    this.#rejectDeviceWaiters(deviceId);
    this.#devices.set(deviceId, {
      accountId,
      deviceId,
      generation,
      pendingJobs: [],
    });
    return generation;
  }

  unregister(deviceId: string): void {
    const device = this.#devices.get(deviceId);
    device?.pollWaiter?.(null);
    this.#devices.delete(deviceId);
    this.#rejectDeviceWaiters(deviceId);
    this.#deleteDeviceResources(deviceId);
  }

  async poll(
    accountId: string,
    deviceId: string,
    generation: string,
    timeoutMs: number,
  ): Promise<WorkerJob | null> {
    const device = this.#devices.get(deviceId);
    if (
      !device ||
      device.accountId !== accountId ||
      device.generation !== generation
    ) {
      throw new Error("unknown_device_generation");
    }

    const queued = device.pendingJobs.shift();
    if (queued) return queued;

    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (device.pollWaiter === waiter) delete device.pollWaiter;
        resolve(null);
      }, timeoutMs);
      const waiter = (job: WorkerJob | null): void => {
        clearTimeout(timer);
        if (device.pollWaiter === waiter) delete device.pollWaiter;
        resolve(job);
      };
      device.pollWaiter = waiter;
    });
  }

  enqueue(
    accountId: string,
    deviceId: string,
    job: WorkerJob,
    timeoutMs: number,
  ): Promise<WorkerResult> {
    const device = this.#devices.get(deviceId);
    if (!device || device.accountId !== accountId) {
      return Promise.reject(new Error("device_offline"));
    }

    const waitingPoll = device.pollWaiter;
    if (waitingPoll) waitingPoll(job);
    else device.pendingJobs.push(job);

    return new Promise((resolve, reject) => {
      const expiresAt = Date.now() + timeoutMs;
      const timer = setTimeout(() => {
        const pending = this.#results.get(job.requestId);
        if (!pending || pending.expiresAt !== expiresAt) return;
        this.#results.delete(job.requestId);
        reject(new Error("job_timeout"));
      }, timeoutMs);
      timer.unref();
      this.#results.set(job.requestId, {
        accountId,
        deviceId,
        resolve,
        reject,
        expiresAt,
        timer,
      });
    });
  }

  complete(
    accountId: string,
    deviceId: string,
    result: WorkerResult,
  ): boolean {
    const waiter = this.#results.get(result.requestId);
    if (
      !waiter ||
      waiter.accountId !== accountId ||
      waiter.deviceId !== deviceId
    ) {
      return false;
    }
    this.#results.delete(result.requestId);
    clearTimeout(waiter.timer);
    waiter.resolve(result);
    return true;
  }

  rememberWorkspace(
    accountId: string,
    deviceId: string,
    workspaceId: string,
  ): void {
    this.#workspaces.set(workspaceId, { accountId, deviceId });
  }

  deviceForWorkspace(accountId: string, workspaceId: string): string | null {
    const workspace = this.#workspaces.get(workspaceId);
    return workspace?.accountId === accountId ? workspace.deviceId : null;
  }

  forgetWorkspace(accountId: string, workspaceId: string): boolean {
    const workspace = this.#workspaces.get(workspaceId);
    if (!workspace || workspace.accountId !== accountId) return false;
    return this.#workspaces.delete(workspaceId);
  }

  rememberCommand(
    accountId: string,
    deviceId: string,
    commandId: string,
  ): void {
    this.#commands.set(commandId, { accountId, deviceId });
  }

  deviceForCommand(accountId: string, commandId: string): string | null {
    const command = this.#commands.get(commandId);
    return command?.accountId === accountId ? command.deviceId : null;
  }

  listDevices(accountId: string): Array<{
    deviceId: string;
    path: ".";
  }> {
    return [...this.#devices.values()]
      .filter((device) => device.accountId === accountId)
      .map((device) => ({
        deviceId: device.deviceId,
        path: ".",
      }));
  }

  #rejectDeviceWaiters(deviceId: string): void {
    for (const [requestId, waiter] of this.#results) {
      if (waiter.deviceId !== deviceId) continue;
      clearTimeout(waiter.timer);
      this.#results.delete(requestId);
      waiter.reject(new Error("device_offline"));
    }
  }

  #deleteDeviceResources(deviceId: string): void {
    for (const [workspaceId, workspace] of this.#workspaces) {
      if (workspace.deviceId === deviceId) this.#workspaces.delete(workspaceId);
    }
    for (const [commandId, command] of this.#commands) {
      if (command.deviceId === deviceId) this.#commands.delete(commandId);
    }
  }
}
