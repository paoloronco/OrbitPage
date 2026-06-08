/**
 * consent-manager.ts — Lynx Consent Manager
 *
 * A module-level singleton that manages cookie consent state for the public page.
 *
 * Key responsibilities:
 *  - Read / write the consent record to localStorage
 *  - Determine whether the native banner needs to be shown
 *  - Gate third-party scripts behind category consent
 *  - Emit Google Consent Mode v2 signals when consent changes
 *  - Inject external CMP scripts (builder mode)
 *
 * Public surface (also exposed on window.LynxConsent):
 *   consentManager.init(config)
 *   consentManager.isGranted('analytics')
 *   consentManager.needsBanner()
 *   consentManager.acceptAll()
 *   consentManager.rejectAll()
 *   consentManager.savePreferences({ analytics: true, ... })
 *   consentManager.registerConsentDependentScript('analytics', () => loadGA4())
 *   consentManager.onConsentChange(cb)
 *   consentManager.showBanner()
 *   consentManager.openPreferences()
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing';

/** Persisted consent record stored in localStorage */
export interface ConsentRecord {
  /** Schema version — bump when the shape changes to invalidate old records */
  version: number;
  /** Policy version string from hardcoded config at time of consent */
  policyVersion: string;
  /** ISO timestamp of when consent was given */
  timestamp: string;
  /** How consent was collected */
  source: 'banner' | 'preferences-modal';
  /** Per-category consent flags */
  categories: Record<ConsentCategory, boolean>;
}

export interface CategoryConfig {
  enabled: boolean;
  title: string;
  description: string;
}

export interface HardcodedBannerConfig {
  policyVersion: string;
  texts: {
    title: string;
    description: string;
    acceptAll: string;
    rejectAll: string;
    managePreferences: string;
    savePreferences: string;
    reopenLabel: string;
    privacyPolicyLinkText: string;
    cookiePolicyLinkText: string;
  };
  urls: { privacyPolicy: string; cookiePolicy: string };
  categories: {
    preferences: CategoryConfig;
    analytics: CategoryConfig;
    marketing: CategoryConfig;
  };
  layout: 'bottom-bar' | 'centered-modal' | 'corner-popup';
  theme: 'light' | 'dark' | 'auto';
  buttonPriority: 'equal' | 'reject-first';
  geoMode: 'global' | 'eu-only' | 'always';
  consentExpiryDays: number;
  reshowOnVersionChange: boolean;
  legalFooterText: string;
}

export interface BuilderConfig {
  provider: 'iubenda' | 'cookiebot' | 'cookieyes' | 'onetrust' | 'custom';
  providerConfig: {
    siteId?: string;
    cookiePolicyId?: string;
    scriptId?: string;
    headSnippet?: string;
    bodySnippet?: string;
    privacyPolicyUrl?: string;
    cookiePolicyUrl?: string;
  };
  reopenSelector: string;
}

export interface ConsentConfig {
  mode: 'disabled' | 'hardcoded' | 'builder';
  enabled: boolean;
  hardcoded?: HardcodedBannerConfig;
  builder?: BuilderConfig;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** localStorage key for the user's consent record */
const STORAGE_KEY = 'lynx_consent_v1';

/** Current schema version — increment to invalidate stored records on breaking changes */
const SCHEMA_VERSION = 1;

/** Categories that are always active and cannot be opted out of */
const ALWAYS_ACTIVE: ConsentCategory[] = ['necessary'];

type ConsentChangeListener = (record: ConsentRecord | null) => void;
type ScriptLoader = () => void;

// ── Consent Manager Class ────────────────────────────────────────────────────

class ConsentManager {
  private config: ConsentConfig | null = null;
  private consent: ConsentRecord | null = null;
  private initialized = false;
  private listeners: Set<ConsentChangeListener> = new Set();
  private externalConsent: Partial<Record<ConsentCategory, boolean>> | null = null;
  /**
   * Scripts waiting for a specific category's consent.
   * Keyed by category; values are loader functions to call when consent is granted.
   */
  private pendingScripts: Map<ConsentCategory, ScriptLoader[]> = new Map();
  /** Callback registered by CookieBanner to show the banner programmatically */
  private _showBannerCb: (() => void) | null = null;
  /** Callback registered by CookieBanner to open the preferences modal */
  private _openPrefsCb: (() => void) | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialise the consent manager with the config fetched from the backend.
   * Idempotent — safe to call more than once (e.g. HMR in dev mode).
   */
  init(config: ConsentConfig): void {
    this.config = config;
    this.consent = this._loadFromStorage();
    this.ensureGoogleConsentDefaults();
    this.initialized = true;
    // Immediately fire any scripts registered before init() was called
    this._dispatchPendingScripts();
  }

  /** Whether init() has been called at least once */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Return the active configuration (or null if not yet initialised) */
  getConfig(): ConsentConfig | null {
    return this.config;
  }

  /** Return the current consent record, or null if no consent has been given */
  getConsent(): ConsentRecord | null {
    return this.consent;
  }

  /**
   * Ensure Google Consent Mode v2 defaults exist before any tracking script loads.
   * Runs only when a native or external consent setup is enabled.
   */
  ensureGoogleConsentDefaults(): void {
    if (!this.config?.enabled || this.config.mode === 'disabled') return;
    if (this._configuredProviderAlreadySetsGcmDefault()) return;

    const win = window as any;
    win.dataLayer = win.dataLayer || [];
    if (this._dataLayerHasGcmDefault(win.dataLayer)) {
      win.__lynxGcmDefaultConsentSet = true;
      return;
    }

    if (typeof win.gtag !== 'function') {
      win.gtag = function () { win.dataLayer.push(arguments); };
    }

    win.gtag('consent', 'default', this._buildGcmState());
    win.__lynxGcmDefaultConsentSet = true;
  }

  /**
   * Returns true when the user has granted consent for `category`.
   * 'necessary' always returns true.
   *
   * Returns false when consent is absent, expired, or requires a re-prompt
   * due to a policy version change — mirroring the same validity conditions
   * that needsBanner() uses. This prevents stale consent from silently
   * granting tracker access while the banner is being re-shown.
   */
  isGranted(category: ConsentCategory): boolean {
    if (ALWAYS_ACTIVE.includes(category)) return true;
    // When consent management is disabled, all categories are implicitly granted.
    // The operator has chosen not to gate tracking behind a consent banner.
    if (!this.config?.enabled || this.config.mode === 'disabled') return true;
    if (this.config?.mode === 'builder') {
      return this._isExternalCategoryGranted(category);
    }
    if (!this.consent) return false;
    if (!this._isConsentFresh()) return false;
    const cfg = this.config?.hardcoded;
    if (
      cfg?.reshowOnVersionChange &&
      cfg.policyVersion &&
      this.consent.policyVersion !== cfg.policyVersion
    ) return false;
    return this.consent.categories?.[category] === true;
  }

  /**
   * Returns true when the native banner should be displayed to this visitor.
   *
   * Returns false when:
   *  - The feature is disabled
   *  - Builder mode is active (external CMP manages its own banner)
   *  - Valid, unexpired consent already exists for the current policy version
   */
  needsBanner(): boolean {
    if (!this.config?.enabled || this.config.mode === 'disabled') return false;
    if (this.config.mode === 'builder') return false;
    if (!this.consent) return true;
    if (!this._isConsentFresh()) return true;
    // Re-show when the policy version has changed and the config says to
    const cfg = this.config.hardcoded;
    if (
      cfg?.reshowOnVersionChange &&
      cfg.policyVersion &&
      this.consent.policyVersion !== cfg.policyVersion
    ) {
      return true;
    }
    return false;
  }

  // ── Consent Actions ────────────────────────────────────────────────────────

  /** Accept all cookie categories (necessary + all optional) */
  acceptAll(source: 'banner' | 'preferences-modal' = 'banner'): void {
    const categories = this._buildAllCategories(true);
    this._saveConsent({ categories, source });
    this._dispatchGcmUpdate(categories);
    this._dispatchPendingScripts();
  }

  /** Reject all optional categories (necessary remains active) */
  rejectAll(source: 'banner' | 'preferences-modal' = 'banner'): void {
    const categories = this._buildAllCategories(false);
    this._saveConsent({ categories, source });
    this._dispatchGcmUpdate(categories);
    // No pending scripts are fired for denied categories
  }

  /**
   * Save granular preferences from the preferences modal.
   * Necessary is always true regardless of what is passed.
   */
  savePreferences(
    selected: Partial<Record<ConsentCategory, boolean>>,
    source: 'banner' | 'preferences-modal' = 'preferences-modal',
  ): void {
    const categories: Record<ConsentCategory, boolean> = {
      necessary:   true,
      preferences: selected.preferences ?? false,
      analytics:   selected.analytics   ?? false,
      marketing:   selected.marketing   ?? false,
    };
    this._saveConsent({ categories, source });
    this._dispatchGcmUpdate(categories);
    this._dispatchPendingScripts();
  }

  // ── Script Registration ────────────────────────────────────────────────────

  /**
   * Register a script loader that must only run after `category` consent is granted.
   *
   * - If consent for `category` is already granted, `loader` is called immediately.
   * - Otherwise it is queued and called when consent is given (acceptAll / savePreferences).
   * - Necessary scripts can be registered but will always fire immediately.
   *
   * Pattern:
   *   consentManager.registerConsentDependentScript('analytics', () => {
   *     window.gtag?.('config', 'G-XXXXXXXXXX');
   *   });
   */
  registerConsentDependentScript(category: ConsentCategory, loader: ScriptLoader): void {
    if (this.isGranted(category)) {
      this._safeCall(loader);
      return;
    }
    const queue = this.pendingScripts.get(category) ?? [];
    queue.push(loader);
    this.pendingScripts.set(category, queue);
  }

  // ── Change Listeners ───────────────────────────────────────────────────────

  /**
   * Subscribe to consent changes.
   * Returns an unsubscribe function.
   *
   *   const off = consentManager.onConsentChange((record) => { ... });
   *   // Later:
   *   off();
   */
  onConsentChange(callback: ConsentChangeListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // ── UI Integration ─────────────────────────────────────────────────────────

  /** Programmatically show the consent banner (calls CookieBanner's internal callback) */
  showBanner(): void {
    this._showBannerCb?.();
  }

  /** Programmatically open the preferences modal */
  openPreferences(): void {
    this._openPrefsCb?.();
  }

  /**
   * Called by CookieBanner to register its imperative show/openPrefs handlers.
   * Internal — do not call from application code.
   */
  _registerUICallbacks(showBanner: () => void, openPreferences: () => void): void {
    this._showBannerCb = showBanner;
    this._openPrefsCb = openPreferences;
  }

  // ── Builder Mode ───────────────────────────────────────────────────────────

  /**
   * Inject the external CMP script(s) chosen in builder mode.
   * Idempotent — checks for #lynx-cmp-script before injecting.
   * Only runs when mode === 'builder' and enabled === true.
   */
  injectBuilderScript(): void {
    if (
      !this.config ||
      this.config.mode !== 'builder' ||
      !this.config.enabled ||
      !this.config.builder
    ) {
      return;
    }
    if (document.getElementById('lynx-cmp-script')) return; // already injected

    const { provider, providerConfig } = this.config.builder;
    switch (provider) {
      case 'iubenda':   this._injectIubenda(providerConfig);   break;
      case 'cookiebot': this._injectCookiebot(providerConfig); break;
      case 'cookieyes': this._injectCookieYes(providerConfig); break;
      case 'onetrust':  this._injectOneTrust(providerConfig);  break;
      case 'custom':    this._injectCustom(providerConfig);    break;
      default:
        console.warn('[LynxConsent] Unknown builder provider:', provider);
    }
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private _buildAllCategories(value: boolean): Record<ConsentCategory, boolean> {
    return { necessary: true, preferences: value, analytics: value, marketing: value };
  }

  private _saveConsent(opts: {
    categories: Record<ConsentCategory, boolean>;
    source: 'banner' | 'preferences-modal';
  }): void {
    const policyVersion = this.config?.hardcoded?.policyVersion ?? '1.0';
    const record: ConsentRecord = {
      version:       SCHEMA_VERSION,
      policyVersion,
      timestamp:     new Date().toISOString(),
      source:        opts.source,
      categories:    opts.categories,
    };
    this.consent = record;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn('[LynxConsent] Could not persist consent to localStorage:', e);
    }
    this._notifyListeners();
  }

  private _loadFromStorage(): ConsentRecord | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: ConsentRecord = JSON.parse(raw);
      // Reject records written by an incompatible schema version
      if (parsed?.version !== SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private _isConsentFresh(): boolean {
    if (!this.consent) return false;
    const expiryDays = this.config?.hardcoded?.consentExpiryDays ?? 365;
    const given = new Date(this.consent.timestamp);
    const expiry = new Date(given);
    expiry.setDate(expiry.getDate() + expiryDays);
    return new Date() < expiry;
  }

  private _dispatchPendingScripts(): void {
    for (const [category, loaders] of this.pendingScripts.entries()) {
      if (this.isGranted(category)) {
        this.pendingScripts.delete(category);
        for (const loader of loaders) {
          this._safeCall(loader);
        }
      }
    }
  }

  private _notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(this.consent); } catch (e) {
        console.error('[LynxConsent] Listener error:', e);
      }
    }
  }

  private _configuredProviderAlreadySetsGcmDefault(): boolean {
    if (this.config?.mode !== 'builder') return false;
    const providerConfig = this.config.builder?.providerConfig;
    return this._textHasGcmDefault(providerConfig?.headSnippet) ||
      this._textHasGcmDefault(providerConfig?.bodySnippet);
  }

  private _textHasGcmDefault(value?: string): boolean {
    return typeof value === 'string' &&
      /gtag\s*\(\s*['"]consent['"]\s*,\s*['"]default['"]/i.test(value);
  }

  private _dataLayerHasGcmDefault(dataLayer: unknown[]): boolean {
    return dataLayer.some((entry) => {
      const values = Array.isArray(entry) ? entry : Array.from(entry as ArrayLike<unknown> || []);
      return values[0] === 'consent' && values[1] === 'default';
    });
  }

  /**
   * Emit Google Consent Mode v2 signals after a consent change.
   * Safe no-op when gtag is not yet on the page.
   *
   * Call order matters: consent update MUST be sent before gtag('config', ID)
   * so that Google processes the correct consent state for the first hit.
   * The registered consent-dependent scripts (which call config) are fired
   * by _dispatchPendingScripts() immediately after this method returns.
   */
  private _dispatchGcmUpdate(categories: Record<ConsentCategory, boolean>): void {
    this.ensureGoogleConsentDefaults();
    const gtag = (window as any).gtag;
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', this._buildGcmState(categories));
  }

  private _safeCall(fn: () => void): void {
    try { fn(); } catch (e) {
      console.error('[LynxConsent] Script loader error:', e);
    }
  }

  private _buildGcmState(categories?: Partial<Record<ConsentCategory, boolean>>) {
    const isAllowed = (category: ConsentCategory) =>
      categories ? categories[category] === true : this.isGranted(category);

    return {
      analytics_storage: isAllowed('analytics') ? 'granted' : 'denied',
      ad_storage: isAllowed('marketing') ? 'granted' : 'denied',
      ad_user_data: isAllowed('marketing') ? 'granted' : 'denied',
      ad_personalization: isAllowed('marketing') ? 'granted' : 'denied',
      functionality_storage: isAllowed('preferences') ? 'granted' : 'denied',
      personalization_storage: isAllowed('preferences') ? 'granted' : 'denied',
      security_storage: 'granted',
      wait_for_update: 2000,
    };
  }

  private _isExternalCategoryGranted(category: ConsentCategory): boolean {
    if (!this.config?.enabled || this.config.mode !== 'builder') return false;

    const cookiebotConsent = (window as any).Cookiebot?.consent;
    if (cookiebotConsent && this.config.builder?.provider === 'cookiebot') {
      if (category === 'preferences') return cookiebotConsent.preferences === true;
      if (category === 'analytics') return cookiebotConsent.statistics === true;
      if (category === 'marketing') return cookiebotConsent.marketing === true;
    }

    return this.externalConsent?.[category] === true;
  }

  private _setExternalConsent(categories: Record<ConsentCategory, boolean>): void {
    this.externalConsent = categories;
    this._dispatchGcmUpdate(categories);
    this._dispatchPendingScripts();
    this._notifyListeners();
  }

  private _injectHtmlSnippet(target: HTMLElement, html: string, markerId?: string): boolean {
    const template = document.createElement('template');
    template.innerHTML = html;
    let markerApplied = false;

    for (const script of Array.from(template.content.querySelectorAll('script'))) {
      const executableScript = document.createElement('script');
      for (const attr of Array.from(script.attributes)) {
        executableScript.setAttribute(attr.name, attr.value);
      }
      if (script.src && !script.hasAttribute('async') && !script.hasAttribute('defer')) {
        executableScript.async = false;
      }
      if (markerId && !markerApplied) {
        executableScript.id = markerId;
        markerApplied = true;
      }
      executableScript.text = script.textContent ?? '';
      script.replaceWith(executableScript);
    }

    target.appendChild(template.content);
    return markerApplied;
  }

  // ── Builder Provider Injectors ─────────────────────────────────────────────

  private _injectIubenda(cfg: BuilderConfig['providerConfig']): void {
    if (!cfg.siteId || !cfg.cookiePolicyId) {
      console.warn('[LynxConsent] Iubenda: missing siteId or cookiePolicyId');
      return;
    }
    const cfgScript = document.createElement('script');
    cfgScript.id = 'lynx-cmp-config';
    cfgScript.type = 'text/javascript';
    cfgScript.text = `
var _iub = _iub || [];
_iub.csConfiguration = {
  siteId: ${JSON.stringify(cfg.siteId)},
  cookiePolicyId: ${JSON.stringify(cfg.cookiePolicyId)},
  lang: "en",
  storage: { useSiteId: true }
};`;
    document.head.appendChild(cfgScript);

    const autoBlock = document.createElement('script');
    autoBlock.type = 'text/javascript';
    autoBlock.src = `https://cs.iubenda.com/autoblocking/${cfg.siteId}.js`;
    autoBlock.async = true;
    document.head.appendChild(autoBlock);

    const csScript = document.createElement('script');
    csScript.id = 'lynx-cmp-script';
    csScript.src = '//cdn.iubenda.com/cs/iubenda_cs.js';
    csScript.async = true;
    csScript.defer = true;
    document.head.appendChild(csScript);
  }

  private _injectCookiebot(cfg: BuilderConfig['providerConfig']): void {
    if (!cfg.scriptId) {
      console.warn('[LynxConsent] Cookiebot: missing scriptId (cbid)');
      return;
    }
    this._wireCookiebotConsentEvents();
    const script = document.createElement('script');
    script.id = 'lynx-cmp-script';
    script.setAttribute('data-cbid', cfg.scriptId);
    script.setAttribute('data-blockingmode', 'auto');
    script.src = 'https://consent.cookiebot.com/uc.js';
    script.async = true;
    document.head.appendChild(script);
  }

  private _wireCookiebotConsentEvents(): void {
    const win = window as any;
    if (win.__lynxCookiebotConsentEventsWired) return;
    win.__lynxCookiebotConsentEventsWired = true;

    const syncCookiebotConsent = () => {
      const consent = win.Cookiebot?.consent;
      if (!consent) return;
      this._setExternalConsent({
        necessary: true,
        preferences: consent.preferences === true,
        analytics: consent.statistics === true,
        marketing: consent.marketing === true,
      });
    };

    window.addEventListener('CookiebotOnConsentReady', syncCookiebotConsent);
    window.addEventListener('CookiebotOnAccept', syncCookiebotConsent);
    window.addEventListener('CookiebotOnDecline', syncCookiebotConsent);
    window.addEventListener('CookiebotOnLoad', syncCookiebotConsent);
    syncCookiebotConsent();
  }

  private _injectCookieYes(cfg: BuilderConfig['providerConfig']): void {
    if (!cfg.scriptId) {
      console.warn('[LynxConsent] CookieYes: missing scriptId');
      return;
    }
    const script = document.createElement('script');
    script.id = 'lynx-cmp-script';
    script.src = `https://cdn-cookieyes.com/client_data/${cfg.scriptId}/script.js`;
    script.async = true;
    document.head.appendChild(script);
  }

  private _injectOneTrust(cfg: BuilderConfig['providerConfig']): void {
    if (!cfg.siteId) {
      console.warn('[LynxConsent] OneTrust: missing siteId (dataDomainScript)');
      return;
    }
    const script = document.createElement('script');
    script.id = 'lynx-cmp-script';
    script.setAttribute('data-domain-script', cfg.siteId);
    script.src = 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js';
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    document.head.appendChild(script);

    const wrapper = document.createElement('script');
    wrapper.type = 'text/javascript';
    wrapper.text = 'function OptanonWrapper() {}';
    document.head.appendChild(wrapper);
  }

  private _injectCustom(cfg: BuilderConfig['providerConfig']): void {
    /*
     * SECURITY NOTE: Custom snippets are injected verbatim.
     * Only admin-authenticated users can configure these snippets via the API,
     * so the trust boundary here is the admin session, not the public page visitor.
     * Never expose snippet configuration to unauthenticated endpoints.
     */
    let markerApplied = false;
    if (cfg.headSnippet) {
      markerApplied = this._injectHtmlSnippet(document.head, cfg.headSnippet, 'lynx-cmp-script');
    }
    if (cfg.bodySnippet) {
      this._injectHtmlSnippet(document.body, cfg.bodySnippet, markerApplied ? undefined : 'lynx-cmp-script');
    }
  }
}

// ── Singleton Export ─────────────────────────────────────────────────────────

export const consentManager = new ConsentManager();

// Expose on window so external CMPs and legacy tag integrations can query consent
if (typeof window !== 'undefined') {
  (window as any).LynxConsent = consentManager;
}
