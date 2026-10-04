import { it, expect } from 'vitest';
import { quarantineRestoredPrivacy, suppressUnreviewedPrivacy } from './privacy-restore.js';
it.each([true, false])('quarantines all imported executable privacy fields (enabled=%s)', (enabled) => {
  const restored = quarantineRestoredPrivacy({ mode: 'builder', enabled, full_config: JSON.stringify({ restoreReviewRequired: false, builder: { provider: 'iubenda', providerConfig: { headSnippet: '<script>evil()</script>', siteId: 'evil' } }, legalPolicies: { privacyPolicy: { mode: 'embedded', embeddedCode: '<script>evil()</script>' } } }) });
  const config = JSON.parse(restored.full_config);
  expect(config.restoreReviewRequired).toBe(true);
  expect(config.builder.providerConfig.headSnippet).toContain('evil');
  const projection = suppressUnreviewedPrivacy(config);
  expect(projection.builder).toBeUndefined();
  expect(projection.legalPolicies.privacyPolicy.embeddedCode).toBe('');
});
