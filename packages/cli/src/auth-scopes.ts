export function normalizedScopes(value: string | undefined): string[] {
  return [...new Set(value?.trim().split(/\s+/).filter(Boolean) ?? [])].sort();
}

export function scopesMatch(left: string | undefined, right: string | undefined): boolean {
  return JSON.stringify(normalizedScopes(left)) === JSON.stringify(normalizedScopes(right));
}

export function grantedScopesSatisfyRequest(
  granted: string | undefined,
  requested: string,
  hasRefreshToken: boolean,
): boolean {
  const grantedSet = new Set(normalizedScopes(granted));
  return normalizedScopes(requested).every(
    (scope) => grantedSet.has(scope) || (scope === "offline_access" && hasRefreshToken),
  );
}
