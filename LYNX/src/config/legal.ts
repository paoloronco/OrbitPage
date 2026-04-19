export const getEffectivePrivacyPolicyUrl = (configuredUrl?: string | null) =>
  configuredUrl?.trim() || undefined;
