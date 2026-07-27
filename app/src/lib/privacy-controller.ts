export interface PrivacyControllerInput {
  name: string;
  email: string;
  country?: string;
  address?: string;
}

export interface NormalizedPrivacyController {
  name: string;
  email: string;
  country: string;
  address: string;
}

export type PrivacyControllerResult =
  | { controller: undefined; error: null }
  | { controller: NormalizedPrivacyController; error: null }
  | { controller: undefined; error: 'incomplete' | 'invalid-email' };

const PRIVACY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePrivacyController(input: PrivacyControllerInput): PrivacyControllerResult {
  const name = input.name.trim();
  const email = input.email.trim();

  if (!name && !email) {
    return { controller: undefined, error: null };
  }
  if (!name || !email) {
    return { controller: undefined, error: 'incomplete' };
  }
  if (!PRIVACY_EMAIL_PATTERN.test(email)) {
    return { controller: undefined, error: 'invalid-email' };
  }

  return {
    controller: {
      name,
      email,
      country: input.country?.trim() || '',
      address: input.address?.trim() || '',
    },
    error: null,
  };
}
