export const ADMIN_CHECKLIST_SESSION_LIMIT = 3;

const CHECKLIST_LOGIN_COUNT_KEY = "orbitpage-admin-checklist-login-count";
const CHECKLIST_ACTIVE_SESSION_KEY = "orbitpage-admin-checklist-active-session";

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface OnboardingChecklistSession {
  visible: boolean;
  sessionNumber: number;
  sessionLimit: number;
}

function identityKey(prefix: string, identity: string) {
  return `${prefix}:${encodeURIComponent(identity.trim().toLowerCase() || "admin")}`;
}

function readCount(storage: BrowserStorage, key: string) {
  const count = Number.parseInt(storage.getItem(key) || "0", 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function readOnboardingChecklistSession(
  identity: string,
  localStorage?: BrowserStorage,
  sessionStorage?: BrowserStorage,
): OnboardingChecklistSession {
  if (!localStorage || !sessionStorage) {
    return { visible: true, sessionNumber: 1, sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT };
  }

  try {
    const countKey = identityKey(CHECKLIST_LOGIN_COUNT_KEY, identity);
    const sessionKey = identityKey(CHECKLIST_ACTIVE_SESSION_KEY, identity);
    const count = readCount(localStorage, countKey);
    const currentSession = sessionStorage.getItem(sessionKey) === "true";

    return {
      visible: currentSession ? count <= ADMIN_CHECKLIST_SESSION_LIMIT : count < ADMIN_CHECKLIST_SESSION_LIMIT,
      sessionNumber: Math.min(Math.max(count || 1, 1), ADMIN_CHECKLIST_SESSION_LIMIT),
      sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT,
    };
  } catch {
    return { visible: true, sessionNumber: 1, sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT };
  }
}

export function beginOnboardingChecklistSession(
  identity: string,
  localStorage?: BrowserStorage,
  sessionStorage?: BrowserStorage,
): OnboardingChecklistSession {
  if (!localStorage || !sessionStorage) {
    return { visible: true, sessionNumber: 1, sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT };
  }

  try {
    const countKey = identityKey(CHECKLIST_LOGIN_COUNT_KEY, identity);
    const sessionKey = identityKey(CHECKLIST_ACTIVE_SESSION_KEY, identity);
    let count = readCount(localStorage, countKey);
    const currentSession = sessionStorage.getItem(sessionKey) === "true";
    let startedNow = false;

    if (!currentSession && count < ADMIN_CHECKLIST_SESSION_LIMIT) {
      count += 1;
      startedNow = true;
      localStorage.setItem(countKey, String(count));
      sessionStorage.setItem(sessionKey, "true");
    }

    return {
      visible: (currentSession || startedNow) && count <= ADMIN_CHECKLIST_SESSION_LIMIT,
      sessionNumber: Math.min(Math.max(count || 1, 1), ADMIN_CHECKLIST_SESSION_LIMIT),
      sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT,
    };
  } catch {
    return { visible: true, sessionNumber: 1, sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT };
  }
}

export function dismissOnboardingChecklist(identity: string, localStorage?: BrowserStorage, sessionStorage?: BrowserStorage) {
  if (!localStorage || !sessionStorage) return;
  try {
    localStorage.setItem(identityKey(CHECKLIST_LOGIN_COUNT_KEY, identity), String(ADMIN_CHECKLIST_SESSION_LIMIT + 1));
    sessionStorage.removeItem(identityKey(CHECKLIST_ACTIVE_SESSION_KEY, identity));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

export function endOnboardingChecklistSession(identity: string, sessionStorage?: BrowserStorage) {
  if (!sessionStorage) return;
  try {
    sessionStorage.removeItem(identityKey(CHECKLIST_ACTIVE_SESSION_KEY, identity));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}
