export class WorkerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

export function errorCode(error: unknown): string | null {
  return error instanceof WorkerError ? error.code : null;
}
