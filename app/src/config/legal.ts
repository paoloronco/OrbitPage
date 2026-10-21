export const getEffectivePrivacyPolicyUrl = (configuredUrl?: string | null) =>
  configuredUrl?.trim() || undefined;

type PolicyKind = "privacy" | "cookie";
type PolicyMode = "external" | "hosted" | "embedded";

export const getEffectivePolicyUrl = (
  kind: PolicyKind,
  mode?: PolicyMode,
  externalUrl?: string | null,
  profileUrl?: string | null,
) => {
  const localPath = kind === "privacy" ? "/privacy" : "/cookies";
  if (mode === "hosted" || mode === "embedded") return localPath;
  return externalUrl?.trim() || profileUrl?.trim() || localPath;
};
