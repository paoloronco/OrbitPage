import { describe, expect, it } from "vitest";
import {
  ADMIN_CHECKLIST_SESSION_LIMIT,
  beginOnboardingChecklistSession,
  dismissOnboardingChecklist,
  endOnboardingChecklistSession,
  readOnboardingChecklistSession,
} from "./onboarding-checklist-storage";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("onboarding checklist sessions", () => {
  it("counts logins once per session and hides after the third one", () => {
    const local = memoryStorage();
    const firstSession = memoryStorage();

    expect(beginOnboardingChecklistSession("Admin", local, firstSession)).toMatchObject({ visible: true, sessionNumber: 1 });
    expect(beginOnboardingChecklistSession("Admin", local, firstSession)).toMatchObject({ visible: true, sessionNumber: 1 });

    endOnboardingChecklistSession("Admin", firstSession);
    expect(beginOnboardingChecklistSession("Admin", local, firstSession)).toMatchObject({ visible: true, sessionNumber: 2 });
    endOnboardingChecklistSession("Admin", firstSession);
    expect(beginOnboardingChecklistSession("Admin", local, firstSession)).toMatchObject({ visible: true, sessionNumber: 3 });
    endOnboardingChecklistSession("Admin", firstSession);

    expect(beginOnboardingChecklistSession("Admin", local, firstSession)).toMatchObject({ visible: false, sessionNumber: 3 });
  });

  it("keeps each account independent and supports permanent dismissal", () => {
    const local = memoryStorage();
    const session = memoryStorage();

    beginOnboardingChecklistSession("first@example.com", local, session);
    dismissOnboardingChecklist("first@example.com", local, session);

    expect(readOnboardingChecklistSession("first@example.com", local, session).visible).toBe(false);
    expect(beginOnboardingChecklistSession("second@example.com", local, session)).toEqual({
      visible: true,
      sessionNumber: 1,
      sessionLimit: ADMIN_CHECKLIST_SESSION_LIMIT,
    });
  });
});
