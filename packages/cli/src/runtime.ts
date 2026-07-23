export interface BunRuntime {
  isStandaloneExecutable?: boolean;
}

declare const __GLOSSA_STANDALONE__: boolean;

export function isStandaloneExecutable(
  value: unknown =
    typeof __GLOSSA_STANDALONE__ === "boolean"
      ? __GLOSSA_STANDALONE__
      : false,
): boolean {
  if (typeof value === "boolean") return value;
  if (!value || typeof value !== "object") return false;
  return (value as BunRuntime).isStandaloneExecutable === true;
}
