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
  expiresAt: number;
}

export class RouterState {
  readonly #devices = new Map<string, ConnectedDevice>();
  readonly #results = new Map<string, ResultWaiter>();

  register(accountId: string, deviceId: string): string {
    const generation = randomUUID();
    const previous = this.#devices.get(deviceId);
    previous?.pollWaiter?.(null);
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
      this.#results.set(job.requestId, {
        accountId,
        deviceId,
        resolve,
        expiresAt,
      });
      setTimeout(() => {
        const pending = this.#results.get(job.requestId);
        if (!pending || pending.expiresAt !== expiresAt) return;
        this.#results.delete(job.requestId);
        reject(new Error("job_timeout"));
      }, timeoutMs);
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
    waiter.resolve(result);
    return true;
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
}
