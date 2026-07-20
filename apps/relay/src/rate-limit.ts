interface RateLimitEntry {
  count: number;
  resetsAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class FixedWindowRateLimiter {
  readonly #entries = new Map<string, RateLimitEntry>();
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  check(key: string): RateLimitResult {
    const now = this.#now();
    const current = this.#entries.get(key);
    if (!current || current.resetsAt <= now) {
      if (current) this.#entries.delete(key);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return {
      allowed: current.count <= this.#limit,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1_000)),
    };
  }

  consume(key: string): RateLimitResult {
    const now = this.#now();
    const current = this.#entries.get(key);
    const entry =
      !current || current.resetsAt <= now
        ? { count: 0, resetsAt: now + this.#windowMs }
        : current;

    entry.count += 1;
    this.#entries.set(key, entry);

    if (this.#entries.size > 10_000) {
      this.#discardExpired(now);
      while (this.#entries.size > 10_000) {
        const oldestKey = this.#entries.keys().next().value as string | undefined;
        if (!oldestKey) break;
        this.#entries.delete(oldestKey);
      }
    }

    return {
      allowed: entry.count <= this.#limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetsAt - now) / 1_000)),
    };
  }

  #discardExpired(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.resetsAt <= now) this.#entries.delete(key);
    }
  }
}
