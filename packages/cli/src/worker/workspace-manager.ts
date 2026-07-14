import { randomUUID } from "node:crypto";
import path from "node:path";
import { WorkerError } from "./errors.js";
import { validateRelativePath, type PathPolicy } from "./path-policy.js";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;

interface WorkspaceLease {
  id: string;
  relativePath: string;
  expiresAt: number;
}

export interface OpenedWorkspace {
  workspaceId: string;
  path: string;
  expiresAt: string;
}

export class WorkspaceManager {
  readonly #leases = new Map<string, WorkspaceLease>();

  constructor(
    readonly policy: PathPolicy,
    readonly leaseMs = DEFAULT_LEASE_MS,
  ) {}

  async open(relativePath = "."): Promise<OpenedWorkspace> {
    const resolved = await this.policy.resolveDirectory(relativePath);
    const normalized = path.relative(this.policy.root, resolved) || ".";
    const lease: WorkspaceLease = {
      id: randomUUID(),
      relativePath: normalized,
      expiresAt: Date.now() + this.leaseMs,
    };
    this.#leases.set(lease.id, lease);
    return {
      workspaceId: lease.id,
      path: normalized,
      expiresAt: new Date(lease.expiresAt).toISOString(),
    };
  }

  async resolve(workspaceId: string, relativePath = "."): Promise<string> {
    const lease = this.#leases.get(workspaceId);
    if (!lease || lease.expiresAt <= Date.now()) {
      this.#leases.delete(workspaceId);
      throw new WorkerError("workspace_expired", "The workspace lease has expired.");
    }
    lease.expiresAt = Date.now() + this.leaseMs;
    return await this.policy.resolveExisting(
      path.join(lease.relativePath, validateRelativePath(relativePath)),
    );
  }

  relativePath(workspaceId: string, relativePath: string): string {
    const lease = this.#leases.get(workspaceId);
    if (!lease || lease.expiresAt <= Date.now()) {
      this.#leases.delete(workspaceId);
      throw new WorkerError("workspace_expired", "The workspace lease has expired.");
    }
    lease.expiresAt = Date.now() + this.leaseMs;
    return path.join(lease.relativePath, validateRelativePath(relativePath));
  }

  close(workspaceId: string): boolean {
    return this.#leases.delete(workspaceId);
  }
}
