export type PersonalApiTokenAccess = "full" | "read" | "links" | "custom";

export function personalApiTokenAccess(scopes: readonly string[], availableScopes: readonly string[]): PersonalApiTokenAccess {
  const selected = new Set(scopes);
  const matches = (candidate: readonly string[]) => candidate.length === selected.size && candidate.every((scope) => selected.has(scope));

  if (matches(availableScopes)) return "full";
  if (matches(availableScopes.filter((scope) => scope.endsWith(":read")))) return "read";
  if (matches(availableScopes.filter((scope) => scope === "links:read" || scope === "links:write"))) return "links";
  return "custom";
}
