import express from 'express';
import { dbGet, dbRun } from '../database.js';
import { authenticateToken, requireAnyPermission } from '../auth.js';
import { ConsentConfigBodySchema } from '../schemas/consent.schema.js';
import {
  DEFAULT_CONSENT_CONFIG, DEMO_CONSENT_CONFIG, DEMO_LEGAL_URLS,
  applyProfileLegalUrlsToConsentConfig, stripDuplicateLegalUrlsFromConsentConfig,
  validateConsentConfigDomain, canUpdateExecutableConsent, getPublicConsentConfig,
} from '../services/consent-config.js';

export function createConsentConfigRouter({ demoMode, apiLimiter, getProfileLegalUrls, safeJsonParse }) {
  const router = express.Router();
  // GET /api/consent-config/public — unauthenticated, used by the public page at runtime
  router.get('/public', apiLimiter, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (demoMode) {
        return res.json({
          success: true,
          data: {
            mode: 'builder',
            enabled: true,
            ...applyProfileLegalUrlsToConsentConfig(DEMO_CONSENT_CONFIG, DEMO_LEGAL_URLS),
          },
        });
      }

      const row = await dbGet(
        'SELECT mode, enabled, full_config FROM cookie_consent_config ORDER BY id DESC LIMIT 1'
      );
      const legalUrls = await getProfileLegalUrls();
      if (!row || !row.enabled) {
        const config = row ? safeJsonParse(row.full_config, {}) : DEFAULT_CONSENT_CONFIG;
        return res.json({
          success: true,
          data: getPublicConsentConfig(config, 'disabled', false, legalUrls),
        });
      }
      const config = safeJsonParse(row.full_config, {});
      return res.json({
        success: true,
        data: getPublicConsentConfig(config, row.mode, true, legalUrls),
      });
    } catch (err) {
      console.error('Error fetching public consent config:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // GET /api/consent-config — admin, returns full config including timestamps
  router.get('/', authenticateToken, apiLimiter, requireAnyPermission('compliance:write', 'users:manage'), async (req, res) => {
    try {
      if (demoMode) {
        return res.json({
          success: true,
          data: {
            mode: 'builder',
            enabled: true,
            ...applyProfileLegalUrlsToConsentConfig(DEMO_CONSENT_CONFIG, DEMO_LEGAL_URLS),
            createdAt: null,
            updatedAt: null,
          },
        });
      }

      const row = await dbGet(
        'SELECT * FROM cookie_consent_config ORDER BY id DESC LIMIT 1'
      );
      if (!row) {
        const legalUrls = await getProfileLegalUrls();
        return res.json({
          success: true,
          data: {
            mode: 'disabled',
            enabled: false,
            ...applyProfileLegalUrlsToConsentConfig(DEFAULT_CONSENT_CONFIG, legalUrls),
            createdAt: null,
            updatedAt: null,
          },
        });
      }
      const config = safeJsonParse(row.full_config, {});
      const legalUrls = await getProfileLegalUrls();
      return res.json({
        success: true,
        data: {
          id: row.id,
          mode: row.mode,
          enabled: Boolean(row.enabled),
          ...applyProfileLegalUrlsToConsentConfig(config, legalUrls),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (err) {
      console.error('Error fetching consent config:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // PUT /api/consent-config — requires compliance:write
  router.put('/', authenticateToken, apiLimiter, requireAnyPermission('compliance:write', 'users:manage'), async (req, res) => {
    if (demoMode) {
      return res.status(403).json({ success: false, error: 'Config changes are disabled in demo mode.' });
    }

    const parsed = ConsentConfigBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return res.status(400).json({ success: false, error: `Validation error — ${msgs}` });
    }

    const { mode, enabled, legalPolicies, hardcoded, builder } = parsed.data;

    try {
      const existing = await dbGet(
        'SELECT id, mode, enabled, full_config FROM cookie_consent_config ORDER BY id DESC LIMIT 1'
      );
      const existingConfig = existing
        ? { ...safeJsonParse(existing.full_config, {}), mode: existing.mode, enabled: Boolean(existing.enabled) }
        : DEFAULT_CONSENT_CONFIG;
      const canManageUsers = (req.user?.permissions || []).includes('users:manage');
      if (!canManageUsers && !canUpdateExecutableConsent(existingConfig, parsed.data)) {
        return res.status(403).json({
          success: false,
          error: 'Only an administrator can add or activate executable CMP or embedded policy code.',
        });
      }

      const legalUrls = await getProfileLegalUrls();
      const domainErrors = validateConsentConfigDomain(parsed.data, legalUrls);
      if (domainErrors.length > 0) {
        return res.status(400).json({ success: false, error: domainErrors.join(' ') });
      }

      const fullConfig = JSON.stringify({ ...stripDuplicateLegalUrlsFromConsentConfig({ legalPolicies, hardcoded, builder }), ...(!canManageUsers && existingConfig.restoreReviewRequired ? { restoreReviewRequired: true } : {}) });
      if (existing) {
        await dbRun(
          'UPDATE cookie_consent_config SET mode = ?, enabled = ?, full_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [mode, enabled ? 1 : 0, fullConfig, existing.id]
        );
      } else {
        await dbRun(
          'INSERT INTO cookie_consent_config (mode, enabled, full_config) VALUES (?, ?, ?)',
          [mode, enabled ? 1 : 0, fullConfig]
        );
      }
      return res.json({ success: true, message: 'Consent configuration saved successfully.' });
    } catch (err) {
      console.error('Error saving consent config:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  return router;
}
