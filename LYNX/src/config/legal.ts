const env = import.meta.env as Record<string, string | undefined>;

const defaultPolicyId = 'fd1ffcdf-b560-4ea0-ba72-da943d39d953';

export const usercentricsPrivacyPolicyId =
  env.VITE_USERCENTRICS_PRIVACY_POLICY_ID?.trim() || defaultPolicyId;

export const usercentricsPrivacyPolicyLanguage =
  env.VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE?.trim() || 'en';

export const isUsercentricsPrivacyPageEnabled =
  env.VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE !== 'false' &&
  usercentricsPrivacyPolicyId.length > 0;

export const defaultPrivacyPolicyUrl =
  env.VITE_DEFAULT_PRIVACY_POLICY_URL?.trim() ??
  (isUsercentricsPrivacyPageEnabled ? '/privacy' : '');

export const getEffectivePrivacyPolicyUrl = (configuredUrl?: string | null) =>
  defaultPrivacyPolicyUrl || configuredUrl?.trim() || undefined;
