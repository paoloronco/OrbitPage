import { suppressUnreviewedPrivacy } from './privacy-restore.js';

const IUBENDA_LOADER_SNIPPET = `<script type="text/javascript">
  (function (w, d) {
    var loader = function () {
      var s = d.createElement("script"),
          tag = d.getElementsByTagName("script")[0];
      s.src = "https://cdn.iubenda.com/iubenda.js";
      tag.parentNode.insertBefore(s, tag);
    };
    if (w.addEventListener) {
      w.addEventListener("load", loader, false);
    } else if (w.attachEvent) {
      w.attachEvent("onload", loader);
    } else {
      w.onload = loader;
    }
  })(window, document);
</script>`;

const DEMO_PRIVACY_POLICY_EMBED = `<a href="https://www.iubenda.com/privacy-policy/30364665" class="iubenda-white iubenda-noiframe iubenda-embed" title="Privacy Policy">Privacy Policy</a>
${IUBENDA_LOADER_SNIPPET}`;

const DEMO_COOKIE_POLICY_EMBED = `<a href="https://www.iubenda.com/privacy-policy/30364665/cookie-policy" class="iubenda-white iubenda-noiframe iubenda-embed" title="Cookie Policy">Cookie Policy</a>
${IUBENDA_LOADER_SNIPPET}`;

const DEMO_CMP_SCRIPT = '<script type="text/javascript" src="https://embeds.iubenda.com/widgets/1b44c148-fd77-4997-9204-b5bcfbabfe52.js"></script>';

export const DEMO_LEGAL_URLS = {
  privacyPolicyUrl: '/privacy',
  cookiePolicyUrl: '/cookies',
};

export const applyProfileLegalUrlsToConsentConfig = (config, legalUrls) => {
  if (!config || typeof config !== 'object') return config;

  const hasProfileLegalUrls = Boolean(legalUrls.privacyPolicyUrl || legalUrls.cookiePolicyUrl);
  const privacyMode = config.legalPolicies?.privacyPolicy?.mode ||
    (legalUrls.privacyPolicyUrl === '/privacy' ? 'hosted' : 'external');
  const cookieMode = config.legalPolicies?.cookiePolicy?.mode ||
    (legalUrls.cookiePolicyUrl === '/cookies' ? 'hosted' : 'external');
  const legalPolicies = {
    showFooterLinks: Boolean(config.legalPolicies?.showFooterLinks ?? hasProfileLegalUrls),
    privacyPolicy: {
      mode: privacyMode,
      hostedText: config.legalPolicies?.privacyPolicy?.hostedText || '',
      hostedFileName: config.legalPolicies?.privacyPolicy?.hostedFileName || '',
      embeddedCode: config.legalPolicies?.privacyPolicy?.embeddedCode || '',
      externalUrl: legalUrls.privacyPolicyUrl || '',
    },
    cookiePolicy: {
      mode: cookieMode,
      hostedText: config.legalPolicies?.cookiePolicy?.hostedText || '',
      hostedFileName: config.legalPolicies?.cookiePolicy?.hostedFileName || '',
      embeddedCode: config.legalPolicies?.cookiePolicy?.embeddedCode || '',
      externalUrl: legalUrls.cookiePolicyUrl || '',
    },
  };

  const hardcoded = config.hardcoded
    ? {
        ...config.hardcoded,
        urls: {
          privacyPolicy: legalUrls.privacyPolicyUrl || '',
          cookiePolicy: legalUrls.cookiePolicyUrl || '',
        },
      }
    : config.hardcoded;

  const builder = config.builder
    ? {
        ...config.builder,
        providerConfig: {
          ...(config.builder.providerConfig || {}),
          privacyPolicyUrl: '',
          cookiePolicyUrl: '',
        },
      }
    : config.builder;

  return { ...config, legalPolicies, hardcoded, builder };
};

export const stripDuplicateLegalUrlsFromConsentConfig = ({ legalPolicies, hardcoded, builder }) => ({
  legalPolicies: legalPolicies ? {
    ...legalPolicies,
    privacyPolicy: {
      ...(legalPolicies.privacyPolicy || {}),
      externalUrl: '',
    },
    cookiePolicy: {
      ...(legalPolicies.cookiePolicy || {}),
      externalUrl: '',
    },
  } : undefined,
  hardcoded: {
    ...hardcoded,
    urls: { privacyPolicy: '', cookiePolicy: '' },
  },
  builder: {
    ...builder,
    providerConfig: {
      ...(builder?.providerConfig || {}),
      privacyPolicyUrl: '',
      cookiePolicyUrl: '',
    },
  },
});

/**
 * Default consent configuration returned when no row exists in the DB.
 * Hardcoded mode is disabled by default — the admin must explicitly enable it.
 */
export const DEFAULT_CONSENT_CONFIG = {
  legalPolicies: {
    showFooterLinks: false,
    privacyPolicy: {
      mode: 'external',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: '',
    },
    cookiePolicy: {
      mode: 'external',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: '',
    },
  },
  hardcoded: {
    policyVersion: '1.0',
    texts: {
      title: 'We value your privacy',
      description:
        'We use cookies to improve your experience, analyse traffic, and provide personalised content. You can choose which categories to allow or reject all optional cookies.',
      acceptAll: 'Accept all',
      rejectAll: 'Reject all',
      managePreferences: 'Manage preferences',
      savePreferences: 'Save preferences',
      reopenLabel: 'Cookie preferences',
      privacyPolicyLinkText: 'Privacy policy',
      cookiePolicyLinkText: 'Cookie policy',
    },
    urls: { privacyPolicy: '', cookiePolicy: '' },
    categories: {
      preferences: {
        enabled: false,
        title: 'Preferences',
        description:
          'These cookies remember your choices and personalise your experience, such as language or region preferences.',
      },
      analytics: {
        enabled: true,
        title: 'Analytics',
        description:
          'These cookies help us understand how visitors interact with the site by collecting and reporting information anonymously (e.g. Google Analytics).',
      },
      marketing: {
        enabled: false,
        title: 'Marketing',
        description:
          'These cookies track your online activity to help advertisers deliver more relevant advertising or to limit how many times you see an ad.',
      },
    },
    layout: 'bottom-bar',
    theme: 'auto',
    buttonPriority: 'equal',
    geoMode: 'eu-only',
    consentExpiryDays: 365,
    reshowOnVersionChange: true,
    legalFooterText: '',
  },
  builder: {
    provider: 'custom',
    providerConfig: {
      siteId: '',
      cookiePolicyId: '',
      scriptId: '',
      headSnippet: '',
      bodySnippet: '',
      privacyPolicyUrl: '',
      cookiePolicyUrl: '',
    },
    reopenSelector: '',
  },
};

export const DEMO_CONSENT_CONFIG = {
  ...DEFAULT_CONSENT_CONFIG,
  legalPolicies: {
    showFooterLinks: true,
    privacyPolicy: {
      mode: 'embedded',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: DEMO_PRIVACY_POLICY_EMBED,
    },
    cookiePolicy: {
      mode: 'embedded',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: DEMO_COOKIE_POLICY_EMBED,
    },
  },
  builder: {
    ...DEFAULT_CONSENT_CONFIG.builder,
    provider: 'custom',
    providerConfig: {
      ...DEFAULT_CONSENT_CONFIG.builder.providerConfig,
      headSnippet: DEMO_CMP_SCRIPT,
    },
    reopenSelector: '',
  },
};

/**
 * Validate consent config payload and return domain-level errors
 * (e.g. "enabled but no policy URL") that Zod's type-level schema can't catch.
 */
export const validateConsentConfigDomain = (config, legalUrls = {}) => {
  const errors = [];

  if (config.mode === 'hardcoded' && config.enabled) {
    const { categories = {} } = config.hardcoded || {};
    if (!legalUrls.privacyPolicyUrl && !legalUrls.cookiePolicyUrl) {
      errors.push('At least one policy URL must be configured in Admin > Privacy > Legal policies when the native banner is enabled.');
    }
    for (const [key, cat] of Object.entries(categories)) {
      if (cat.enabled && !cat.description?.trim()) {
        errors.push(`The "${key}" category must have a description when it is enabled.`);
      }
    }
  }

  if (config.mode === 'builder' && config.enabled) {
    const { provider = 'custom', providerConfig = {} } = config.builder || {};
    const hasProviderConfig = provider === 'iubenda'
      ? Boolean(providerConfig.headSnippet?.trim() || (providerConfig.siteId?.trim() && providerConfig.cookiePolicyId?.trim()))
      : provider === 'cookiebot' || provider === 'cookieyes'
        ? Boolean(providerConfig.scriptId?.trim())
        : provider === 'onetrust'
          ? Boolean(providerConfig.siteId?.trim())
          : Boolean(providerConfig.headSnippet?.trim() || providerConfig.bodySnippet?.trim());
    if (!hasProviderConfig) errors.push('Complete the selected CMP provider configuration before enabling external consent management.');
  }

  return errors;
};

const getExecutableConsentState = (config = {}) => {
  const providerConfig = config.builder?.providerConfig || {};
  const provider = String(config.builder?.provider || 'custom').trim();
  const builderHead = String(config.builder?.providerConfig?.headSnippet || '').trim();
  const builderBody = String(config.builder?.providerConfig?.bodySnippet || '').trim();
  const privacyCode = String(config.legalPolicies?.privacyPolicy?.embeddedCode || '').trim();
  const cookieCode = String(config.legalPolicies?.cookiePolicy?.embeddedCode || '').trim();
  return {
    builderHead,
    builderBody,
    provider,
    siteId: String(providerConfig.siteId || '').trim(),
    cookiePolicyId: String(providerConfig.cookiePolicyId || '').trim(),
    scriptId: String(providerConfig.scriptId || '').trim(),
    privacyCode,
    cookieCode,
    builderActive: Boolean(config.enabled && config.mode === 'builder' && (builderHead || builderBody || providerConfig.siteId || providerConfig.cookiePolicyId || providerConfig.scriptId)),
    privacyActive: Boolean(config.legalPolicies?.privacyPolicy?.mode === 'embedded' && privacyCode),
    cookieActive: Boolean(config.legalPolicies?.cookiePolicy?.mode === 'embedded' && cookieCode),
  };
};

export const canUpdateExecutableConsent = (existingConfig, nextConfig) => {
  const previous = getExecutableConsentState(existingConfig);
  const next = getExecutableConsentState(nextConfig);
  const codeKeys = ['builderHead', 'builderBody', 'siteId', 'cookiePolicyId', 'scriptId', 'privacyCode', 'cookieCode'];
  const activationKeys = ['builderActive', 'privacyActive', 'cookieActive'];
  const writesExecutableCode = codeKeys.some((key) => next[key] && next[key] !== previous[key]);
  const activatesExecutableCode = activationKeys.some((key) => next[key] && !previous[key]) ||
    (next.builderActive && next.provider !== previous.provider);
  return !writesExecutableCode && !activatesExecutableCode;
};

export const getPublicConsentConfig = (config, mode, enabled, legalUrls) => {
  const safeConfig = applyProfileLegalUrlsToConsentConfig(suppressUnreviewedPrivacy(config), legalUrls);
  const publicPolicy = (policy) => ({
    mode: policy.mode,
    externalUrl: policy.externalUrl,
    ...(policy.mode === 'hosted' ? { hostedText: policy.hostedText, hostedFileName: policy.hostedFileName } : {}),
    ...(policy.mode === 'embedded' ? { embeddedCode: policy.embeddedCode } : {}),
  });
  const publicConfig = {
    legalPolicies: {
      showFooterLinks: safeConfig.legalPolicies.showFooterLinks,
      privacyPolicy: publicPolicy(safeConfig.legalPolicies.privacyPolicy),
      cookiePolicy: publicPolicy(safeConfig.legalPolicies.cookiePolicy),
    },
    hardcoded: safeConfig.hardcoded,
    mode: enabled ? mode : 'disabled',
    enabled: Boolean(enabled),
  };
  if (enabled && mode === 'builder') publicConfig.builder = safeConfig.builder;
  return publicConfig;
};
