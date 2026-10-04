import { ConsentConfigBodySchema } from '../schemas/consent.schema.js';

export function quarantineRestoredPrivacy(row) {
  const config = ConsentConfigBodySchema.parse({ ...JSON.parse(row.full_config || '{}'), mode: row.mode, enabled: Boolean(row.enabled) });
  return { ...row, full_config: JSON.stringify({ ...config, restoreReviewRequired: true }) };
}

export function suppressUnreviewedPrivacy(config) {
  if (!config.restoreReviewRequired) return config;
  return {
    ...config,
    builder: undefined,
    legalPolicies: {
      ...config.legalPolicies,
      privacyPolicy: { ...config.legalPolicies?.privacyPolicy, embeddedCode: '' },
      cookiePolicy: { ...config.legalPolicies?.cookiePolicy, embeddedCode: '' },
    },
  };
}
