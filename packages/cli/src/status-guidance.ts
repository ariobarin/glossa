export function noActiveWorkerHint(
  activeWorkers: number | null,
  deviceCount: number,
): string | null {
  if (deviceCount === 0) return null;
  if (activeWorkers === 0) {
    return 'No active workers. Run "glossa" inside a workspace so ChatGPT can use it.';
  }
  return null;
}
