import {
  loadUserProfile,
  validCredentials,
  type FetchLike,
} from "./auth-session.js";
import type { StoredCredentials } from "./config-store.js";
import {
  listDevices,
  type RelayDevice,
  type RelayEndpoints,
} from "./relay-client.js";

export interface StatusDetails {
  account: string;
  relay: string;
  activeWorkers: number | null;
  devices: RelayDevice[];
}

export interface StatusDependencies {
  validCredentials?: typeof validCredentials;
  loadUserProfile?: typeof loadUserProfile;
  listDevices?: typeof listDevices;
  fetch?: FetchLike;
}

function accountLabel(profile: {
  sub: string;
  name?: string;
  email?: string;
}): string {
  return profile.email ?? profile.name ?? profile.sub;
}

function activeWorkerCount(devices: RelayDevice[]): number | null {
  if (devices.some((device) => device.activeWorkers === null)) return null;
  return devices.reduce((sum, device) => sum + device.activeWorkers!, 0);
}

export class WorkspaceStatusService {
  #credentials: StoredCredentials;
  #account: string | undefined;
  #accountUnavailable = false;
  #cached: StatusDetails | undefined;
  #inFlight: Promise<StatusDetails> | undefined;
  #profileInFlight: Promise<void> | undefined;
  readonly #listeners = new Set<(status: StatusDetails) => void>();

  constructor(
    credentials: StoredCredentials,
    readonly endpoints: RelayEndpoints,
    readonly dependencies: StatusDependencies = {},
  ) {
    this.#credentials = credentials;
  }

  peek(): StatusDetails | undefined {
    return this.#cached;
  }

  subscribe(listener: (status: StatusDetails) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async refresh(
    signal?: AbortSignal,
    waitForAccount = false,
  ): Promise<StatusDetails> {
    let status: StatusDetails;
    if (this.#inFlight) {
      status = await this.#inFlight;
    } else {
      const pending = this.#load(signal);
      this.#inFlight = pending;
      try {
        status = await pending;
      } finally {
        if (this.#inFlight === pending) this.#inFlight = undefined;
      }
    }
    if (waitForAccount && this.#profileInFlight) {
      await this.#profileInFlight;
      return this.#cached ?? status;
    }
    return status;
  }

  async #load(signal?: AbortSignal): Promise<StatusDetails> {
    const validate = this.dependencies.validCredentials ?? validCredentials;
    const devicesForAccount = this.dependencies.listDevices ?? listDevices;
    const baseFetch = this.dependencies.fetch ?? fetch;
    const fetchRequest: FetchLike = signal
      ? async (input, init) => await baseFetch(input, { ...init, signal })
      : baseFetch;

    this.#credentials = await validate(
      this.#credentials,
      signal ? { signal } : {},
    );
    const requestCredentials = this.#credentials;

    if (!this.#account && !this.#profileInFlight) {
      this.#accountUnavailable = false;
      const pending = this.#loadAccount(
        requestCredentials,
        fetchRequest,
        signal,
      ).catch(() => {
        if (signal?.aborted) return;
        this.#accountUnavailable = true;
        if (this.#cached) {
          this.#cached = { ...this.#cached, account: "Account unavailable" };
          this.#publish(this.#cached);
        }
      });
      this.#profileInFlight = pending;
      void pending.finally(() => {
        if (this.#profileInFlight === pending) this.#profileInFlight = undefined;
      });
    }

    const devices = await devicesForAccount(
      this.endpoints,
      requestCredentials,
      fetchRequest,
    );

    const status = {
      account: this.#account ??
        (this.#accountUnavailable ? "Account unavailable" : "Loading account…"),
      relay: this.endpoints.relayOrigin,
      activeWorkers: activeWorkerCount(devices),
      devices,
    };
    this.#cached = status;
    this.#publish(status);
    return status;
  }

  async #loadAccount(
    credentials: StoredCredentials,
    fetchRequest: FetchLike,
    signal?: AbortSignal,
  ): Promise<void> {
    const profile = this.dependencies.loadUserProfile ?? loadUserProfile;
    const result = await profile(
      credentials,
      signal ? { signal, fetch: fetchRequest } : { fetch: fetchRequest },
    );
    this.#credentials = result.credentials;
    this.#account = accountLabel(result.profile);
    this.#accountUnavailable = false;
    if (this.#cached) {
      this.#cached = { ...this.#cached, account: this.#account };
      this.#publish(this.#cached);
    }
  }

  #publish(status: StatusDetails): void {
    for (const listener of this.#listeners) listener(status);
  }
}
