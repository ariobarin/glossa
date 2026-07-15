import {
  workerJobSchema,
  type WorkerJob,
  type WorkerResult,
} from "@glossa/protocol";

const WORKER_REQUEST_TIMEOUT_MS = 19_000;
const DEFAULT_RECONNECT_BASE_MS = 500;
const DEFAULT_RECONNECT_MAX_MS = 10_000;

type Fetcher = typeof fetch;
type Sleeper = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export interface WorkerHandler {
  handle(job: WorkerJob): Promise<WorkerResult>;
}

export interface RemoteWorkerOptions {
  origin: string;
  deviceToken: string;
  worker: WorkerHandler;
  signal: AbortSignal;
  fetcher?: Fetcher;
  sleep?: Sleeper;
  random?: () => number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
}

export class DeviceRejectedError extends Error {
  constructor() {
    super("The relay rejected the device credential.");
    this.name = "DeviceRejectedError";
  }
}

class RelayResponseError extends Error {
  constructor(readonly status: number) {
    super(`The relay returned HTTP ${status}.`);
    this.name = "RelayResponseError";
  }
}

function defaultSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const finish = (): void => {
      signal.removeEventListener("abort", cancel);
      resolve();
    };
    const cancel = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(finish, milliseconds);
    timer.unref();
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export function reconnectDelayMs(
  failureCount: number,
  random: () => number,
  baseMs = DEFAULT_RECONNECT_BASE_MS,
  maximumMs = DEFAULT_RECONNECT_MAX_MS,
): number {
  const ceiling = Math.min(maximumMs, baseMs * 2 ** Math.min(failureCount, 8));
  return Math.floor(ceiling * (0.5 + random() * 0.5));
}

export class RemoteWorker {
  readonly #origin: URL;
  readonly #deviceToken: string;
  readonly #worker: WorkerHandler;
  readonly #signal: AbortSignal;
  readonly #fetcher: Fetcher;
  readonly #sleep: Sleeper;
  readonly #random: () => number;
  readonly #reconnectBaseMs: number;
  readonly #reconnectMaxMs: number;

  constructor(options: RemoteWorkerOptions) {
    this.#origin = new URL(options.origin);
    this.#deviceToken = options.deviceToken;
    this.#worker = options.worker;
    this.#signal = options.signal;
    this.#fetcher = options.fetcher ?? fetch;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#random = options.random ?? Math.random;
    this.#reconnectBaseMs =
      options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    this.#reconnectMaxMs = options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;
  }

  async run(): Promise<void> {
    let failures = 0;
    while (!this.#signal.aborted) {
      try {
        const generation = await this.#register();
        failures = 0;
        await this.#pollGeneration(generation);
      } catch (error) {
        if (this.#signal.aborted) return;
        if (error instanceof DeviceRejectedError) throw error;
        const delay = reconnectDelayMs(
          failures,
          this.#random,
          this.#reconnectBaseMs,
          this.#reconnectMaxMs,
        );
        failures += 1;
        try {
          await this.#sleep(delay, this.#signal);
        } catch (sleepError) {
          if (this.#signal.aborted) return;
          throw sleepError;
        }
      }
    }
  }

  async #register(): Promise<string> {
    const response = await this.#post("/device/register", {});
    const value = (await response.json()) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("generation" in value) ||
      typeof value.generation !== "string"
    ) {
      throw new Error("The relay returned an invalid registration response.");
    }
    return value.generation;
  }

  async #pollGeneration(generation: string): Promise<void> {
    while (!this.#signal.aborted) {
      const response = await this.#post("/device/poll", { generation });
      if (response.status === 204) continue;
      const value = (await response.json()) as unknown;
      const parsed = workerJobSchema.safeParse(
        typeof value === "object" && value !== null && "job" in value
          ? value.job
          : undefined,
      );
      if (!parsed.success) {
        throw new Error("The relay returned an invalid worker job.");
      }
      const result = await this.#worker.handle(parsed.data);
      await this.#post("/device/result", result);
    }
  }

  async #post(path: string, body: unknown): Promise<Response> {
    const timeout = AbortSignal.timeout(WORKER_REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([this.#signal, timeout]);
    const response = await this.#fetcher(new URL(path, this.#origin), {
      method: "POST",
      headers: {
        authorization: `Device ${this.#deviceToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 401) throw new DeviceRejectedError();
    if (!response.ok) throw new RelayResponseError(response.status);
    return response;
  }
}
