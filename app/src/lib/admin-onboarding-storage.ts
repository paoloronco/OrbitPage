export const ADMIN_ONBOARDING_STORAGE_KEY = "orbitpage-admin-onboarding-completed";
export const ADMIN_ONBOARDING_FORCE_STORAGE_KEY = "orbitpage-admin-onboarding-force";
export const ADMIN_ONBOARDING_SESSION_DISMISSED_KEY = "orbitpage-admin-onboarding-dismissed";

export function resetAdminOnboardingProgress() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(ADMIN_ONBOARDING_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_ONBOARDING_FORCE_STORAGE_KEY);
    window.sessionStorage.removeItem(ADMIN_ONBOARDING_SESSION_DISMISSED_KEY);
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}
