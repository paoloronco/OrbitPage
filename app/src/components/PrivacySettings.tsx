/**
 * PrivacySettings.tsx — Admin "Privacy & Cookies" tab
 *
 * Manages cookie consent configuration in two mutually exclusive modes:
 *   1. Hardcoded (native built-in banner)
 *   2. Builder (external CMP integration)
 *
 * The component owns consent API state and receives profile-backed legal policy URLs
 * from the parent so those fields keep their existing persistence path.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle2,
  Cookie,
  ExternalLink,
  FileText,
  Globe2,
  Info,
  LayoutTemplate,
  ListChecks,
  Link2,
  ShieldCheck,
  Sliders,
  Type,
} from 'lucide-react';
import { useAppI18n } from '@/lib/i18n';
import { consentConfigApi, type ConsentConfigData } from '@/lib/api-client';
import { withBasePath } from '@/lib/base-path';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConsentMode = 'disabled' | 'hardcoded' | 'builder';
type LegalPolicyMethod = 'external' | 'hosted' | 'embedded';
type PolicyKind = 'privacy' | 'cookie';

// ── Default / empty config ────────────────────────────────────────────────────

const DEFAULT_HARDCODED: NonNullable<ConsentConfigData['hardcoded']> = {
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
};

const DEFAULT_BUILDER: NonNullable<ConsentConfigData['builder']> = {
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
};

function isBuilderProviderConfigured(builder: NonNullable<ConsentConfigData['builder']>) {
  const cfg = builder.providerConfig;
  if (builder.provider === 'iubenda') return !!cfg.siteId?.trim() && !!cfg.cookiePolicyId?.trim();
  if (builder.provider === 'cookiebot' || builder.provider === 'cookieyes') return !!cfg.scriptId?.trim();
  if (builder.provider === 'onetrust') return !!cfg.siteId?.trim();
  return !!cfg.headSnippet?.trim();
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function isValidPolicyUrl(s: string) {
  if (!s) return true;
  if (s.startsWith('/') && !s.startsWith('//')) return true;
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const HOSTED_POLICY_PATH: Record<PolicyKind, string> = {
  privacy: '/privacy',
  cookie: '/cookies',
};

function getPolicyMethod(url: string | undefined, kind: PolicyKind): LegalPolicyMethod {
  return url?.trim() === HOSTED_POLICY_PATH[kind] ? 'hosted' : 'external';
}

const EMPTY_POLICY_CONFIG = {
  mode: 'external' as LegalPolicyMethod,
  externalUrl: '',
  hostedText: '',
  hostedFileName: '',
  embeddedCode: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="admin-panel-icon mt-0.5">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

function FieldRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </Label>
      {children}
      {description && <p className="text-xs leading-5 text-slate-400">{description}</p>}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-700">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
      configured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {configured ? 'Configured' : 'Missing'}
    </span>
  );
}

function MethodButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
        active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-500'}`} />
        <div>
          <p className={`text-sm font-semibold ${active ? 'text-blue-800' : 'text-slate-800'}`}>{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

function PolicyConfigurator({
  kind,
  title,
  method,
  externalUrl,
  hostedText,
  hostedFileName,
  providerConfig,
  onMethodChange,
  onExternalUrlChange,
  onHostedTextChange,
  onHostedFileNameChange,
  onProviderConfigChange,
}: {
  kind: PolicyKind;
  title: string;
  method: LegalPolicyMethod;
  externalUrl: string;
  hostedText: string;
  hostedFileName: string;
  providerConfig: string;
  onMethodChange: (method: LegalPolicyMethod) => void;
  onExternalUrlChange: (url: string) => void;
  onHostedTextChange: (text: string) => void;
  onHostedFileNameChange: (name: string) => void;
  onProviderConfigChange: (config: string) => void;
}) {
  const hostedPath = HOSTED_POLICY_PATH[kind];
  const resolvedUrl =
    method === 'hosted' ? hostedPath :
    method === 'embedded' ? hostedPath :
    externalUrl.trim();
  const configured =
    method === 'embedded' ? !!providerConfig.trim() :
    method === 'hosted' ? !!hostedText.trim() :
    !!resolvedUrl;

  const handleFile = async (file?: File) => {
    if (!file) return;
    onHostedFileNameChange(file.name);
    if (file.name.toLowerCase().endsWith('.txt')) {
      onHostedTextChange(await file.text());
      return;
    }
    onHostedTextChange(`Uploaded file: ${file.name}`);
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Choose the simplest option that matches what you already have.
          </p>
        </div>
        <StatusBadge configured={configured} />
      </div>

      <FieldRow label={`How do you want to provide your ${title.toLowerCase()}?`}>
        <div className="grid gap-2">
          <MethodButton
            active={method === 'external'}
            icon={Link2}
            title="External link"
            description="Use a page you already have."
            onClick={() => onMethodChange('external')}
          />
          <MethodButton
            active={method === 'hosted'}
            icon={FileText}
            title="Host it in OrbitPage"
            description={`Use the built-in ${hostedPath} page.`}
            onClick={() => onMethodChange('hosted')}
          />
          <MethodButton
            active={method === 'embedded'}
            icon={Sliders}
            title="Embedded"
            description="Paste HTML or a script from a policy service."
            onClick={() => onMethodChange('embedded')}
          />
        </div>
      </FieldRow>

      {method === 'external' && (
        <FieldRow label="Page URL" description="Users will be redirected to this page.">
          <Input
            className="admin-input"
            value={externalUrl}
            onChange={(e) => onExternalUrlChange(e.target.value)}
            placeholder={kind === 'privacy' ? 'https://example.com/privacy' : 'https://example.com/cookies'}
            spellCheck={false}
            maxLength={500}
          />
        </FieldRow>
      )}

      {method === 'hosted' && (
        <div className="space-y-3">
          <InfoBox>OrbitPage will generate a public page at {hostedPath}</InfoBox>
          <FieldRow label="Policy text">
            <Textarea
              className="admin-input min-h-[120px] resize-y text-sm"
              value={hostedText}
              onChange={(e) => onHostedTextChange(e.target.value)}
              placeholder={`Paste your ${title.toLowerCase()} text here.`}
            />
          </FieldRow>
          <FieldRow label="Upload text file" description=".txt files are copied into the text box. .docx files can be selected as a reminder for manual review.">
            <Input
              className="admin-input"
              type="file"
              accept=".txt,.docx"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            {hostedFileName && (
              <p className="text-xs leading-5 text-slate-500">Selected: {hostedFileName}</p>
            )}
          </FieldRow>
          <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 underline" href={withBasePath(hostedPath)} target="_blank" rel="noopener noreferrer">
            Preview {hostedPath}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {method === 'embedded' && (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Advanced - embedded policy
          </summary>
          <div className="mt-3 space-y-3">
            <FieldRow label="Policy embed code" description={`Paste the HTML or script for this document. OrbitPage will render it at ${hostedPath}.`}>
              <Textarea
                className="admin-input min-h-[120px] resize-y font-mono text-xs"
                value={providerConfig}
                onChange={(e) => onProviderConfigChange(e.target.value)}
                placeholder="<script src=&quot;https://...&quot;></script>"
              />
            </FieldRow>
            {providerConfig.trim() ? (
              <p className="text-xs text-green-700">Embedded policy configured. Use Preview to verify the public page.</p>
            ) : (
              <p className="text-xs text-amber-700">Missing: paste the embed code from your policy service.</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function LegalPoliciesForm({
  showLegalLinks,
  onShowLegalLinksChange,
  privacy,
  cookie,
}: {
  showLegalLinks: boolean;
  onShowLegalLinksChange: (show: boolean) => void;
  privacy: Omit<React.ComponentProps<typeof PolicyConfigurator>, 'kind' | 'title'>;
  cookie: Omit<React.ComponentProps<typeof PolicyConfigurator>, 'kind' | 'title'>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">Show legal links in footer</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            When enabled, visitors can open these links from the public footer and consent banner.
          </p>
        </div>
        <Switch checked={showLegalLinks} onCheckedChange={onShowLegalLinksChange} />
      </div>

      {showLegalLinks && (
        <div className="space-y-4">
          <PolicyConfigurator kind="privacy" title="Privacy Policy" {...privacy} />
          <PolicyConfigurator kind="cookie" title="Cookie Policy" {...cookie} />
          <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <span className="font-semibold text-slate-700">Preview built-in pages:</span>
            <a className="inline-flex items-center gap-1 text-blue-700 underline" href={withBasePath('/privacy')} target="_blank" rel="noopener noreferrer">
              /privacy <ExternalLink className="h-3 w-3" />
            </a>
            <a className="inline-flex items-center gap-1 text-blue-700 underline" href={withBasePath('/cookies')} target="_blank" rel="noopener noreferrer">
              /cookies <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  cat,
  label,
  catCfg,
  onChange,
}: {
  cat: string;
  label: string;
  catCfg: { enabled: boolean; title: string; description: string };
  onChange: (updates: Partial<typeof catCfg>) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">
            {catCfg.enabled ? 'Visible in preferences modal' : 'Hidden from users'}
          </p>
        </div>
        <Switch
          checked={catCfg.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
      </div>
      {catCfg.enabled && (
        <div className="space-y-2 pt-1">
          <FieldRow label="Category title">
            <Input
              className="admin-input"
              value={catCfg.title}
              onChange={(e) => onChange({ title: e.target.value })}
              maxLength={100}
            />
          </FieldRow>
          <FieldRow label="Description (shown to users)" description="Required when the category is enabled.">
            <Textarea
              className="admin-input min-h-[72px] resize-y text-sm"
              value={catCfg.description}
              onChange={(e) => onChange({ description: e.target.value })}
              maxLength={1000}
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

// ── Hardcoded Banner Form ─────────────────────────────────────────────────────

function HardcodedForm({
  cfg,
  onChange,
}: {
  cfg: NonNullable<ConsentConfigData['hardcoded']>;
  onChange: (updates: Partial<NonNullable<ConsentConfigData['hardcoded']>>) => void;
}) {
  const updateTexts = (updates: Partial<typeof cfg.texts>) =>
    onChange({ texts: { ...cfg.texts, ...updates } });
  const updateCat = (
    cat: keyof typeof cfg.categories,
    updates: Partial<(typeof cfg.categories)[typeof cat]>,
  ) => onChange({ categories: { ...cfg.categories, [cat]: { ...cfg.categories[cat], ...updates } } });

  return (
    <Tabs defaultValue="content" className="mt-1">
      <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-slate-100 p-1">
        {[
          { value: 'content', label: 'Banner text', icon: Type },
          { value: 'categories', label: 'Categories', icon: ListChecks },
          { value: 'appearance', label: 'Appearance', icon: LayoutTemplate },
          { value: 'advanced', label: 'Advanced', icon: Sliders },
        ].map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ── Banner text ── */}
      <TabsContent value="content" className="space-y-4">
        <InfoBox>
          These texts appear in the consent banner visible to your visitors. Keep them clear and
          specific enough for informed consent (GDPR requirement).
        </InfoBox>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Banner title">
            <Input className="admin-input" value={cfg.texts.title}
              onChange={(e) => updateTexts({ title: e.target.value })} maxLength={200} />
          </FieldRow>
          <FieldRow label="Accept button label">
            <Input className="admin-input" value={cfg.texts.acceptAll}
              onChange={(e) => updateTexts({ acceptAll: e.target.value })} maxLength={100} />
          </FieldRow>
        </div>
        <FieldRow label="Banner description" description="Explain what cookies are used for. Be specific.">
          <Textarea className="admin-input min-h-[80px] resize-y text-sm" value={cfg.texts.description}
            onChange={(e) => updateTexts({ description: e.target.value })} maxLength={2000} />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Reject button label">
            <Input className="admin-input" value={cfg.texts.rejectAll}
              onChange={(e) => updateTexts({ rejectAll: e.target.value })} maxLength={100} />
          </FieldRow>
          <FieldRow label="Manage preferences label">
            <Input className="admin-input" value={cfg.texts.managePreferences}
              onChange={(e) => updateTexts({ managePreferences: e.target.value })} maxLength={100} />
          </FieldRow>
          <FieldRow label="Save preferences label">
            <Input className="admin-input" value={cfg.texts.savePreferences}
              onChange={(e) => updateTexts({ savePreferences: e.target.value })} maxLength={100} />
          </FieldRow>
          <FieldRow label="Reopen chip label">
            <Input className="admin-input" value={cfg.texts.reopenLabel}
              onChange={(e) => updateTexts({ reopenLabel: e.target.value })} maxLength={100} />
          </FieldRow>
          <FieldRow label="Privacy policy link text">
            <Input className="admin-input" value={cfg.texts.privacyPolicyLinkText}
              onChange={(e) => updateTexts({ privacyPolicyLinkText: e.target.value })} maxLength={100} />
          </FieldRow>
          <FieldRow label="Cookie policy link text">
            <Input className="admin-input" value={cfg.texts.cookiePolicyLinkText}
              onChange={(e) => updateTexts({ cookiePolicyLinkText: e.target.value })} maxLength={100} />
          </FieldRow>
        </div>
        <FieldRow label="Legal / help text" description="Optional small-print shown at the bottom of the preferences modal.">
          <Textarea className="admin-input min-h-[64px] resize-y text-sm" value={cfg.legalFooterText}
            onChange={(e) => onChange({ legalFooterText: e.target.value })} maxLength={500} />
        </FieldRow>
      </TabsContent>

      {/* ── Categories ── */}
      <TabsContent value="categories" className="space-y-4">
        <InfoBox>
          <strong>Necessary</strong> cookies are always active and cannot be disabled by visitors.
          Enable optional categories only when you actually use them — each enabled category must
          have a clear description (GDPR transparency requirement).
        </InfoBox>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Necessary</p>
              <p className="text-xs text-slate-500">Always active — essential for site functionality</p>
            </div>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              Always on
            </span>
          </div>
        </div>
        {(
          [
            ['preferences', 'Preferences'],
            ['analytics', 'Analytics'],
            ['marketing', 'Marketing'],
          ] as const
        ).map(([cat, label]) => (
          <CategorySection
            key={cat}
            cat={cat}
            label={label}
            catCfg={cfg.categories[cat]}
            onChange={(u) => updateCat(cat, u)}
          />
        ))}
      </TabsContent>

      {/* ── Appearance ── */}
      <TabsContent value="appearance" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Banner layout">
            <Select value={cfg.layout} onValueChange={(v: typeof cfg.layout) => onChange({ layout: v })}>
              <SelectTrigger className="admin-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-bar">Bottom bar (recommended)</SelectItem>
                <SelectItem value="centered-modal">Centered modal</SelectItem>
                <SelectItem value="corner-popup">Corner popup</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Color theme">
            <Select value={cfg.theme} onValueChange={(v: typeof cfg.theme) => onChange({ theme: v })}>
              <SelectTrigger className="admin-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (follows system)</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
        <FieldRow
          label="Button priority"
          description='Choose "Reject first" to place the reject button before accept — required in some EU member states.'
        >
          <Select
            value={cfg.buttonPriority}
            onValueChange={(v: typeof cfg.buttonPriority) => onChange({ buttonPriority: v })}
          >
            <SelectTrigger className="admin-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equal">Equal weight (Manage · Reject · Accept)</SelectItem>
              <SelectItem value="reject-first">Reject first (Reject · Manage · Accept)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <InfoBox>
          "Reject all" and "Accept all" always receive the same visual size and weight by design.
          This satisfies the EDPB and Italian Garante guidance that opt-out must be as easy as
          opt-in.
        </InfoBox>
      </TabsContent>

      {/* ── Advanced ── */}
      <TabsContent value="advanced" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow
            label="Geo behaviour"
            description="Who sees the banner. 'EU/EEA only' is the recommended default."
          >
            <Select value={cfg.geoMode} onValueChange={(v: typeof cfg.geoMode) => onChange({ geoMode: v })}>
              <SelectTrigger className="admin-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eu-only">EU / EEA / UK only (recommended)</SelectItem>
                <SelectItem value="global">Global (all visitors)</SelectItem>
                <SelectItem value="always">Always show</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow
            label="Consent validity (days)"
            description="How long stored consent is considered valid before re-prompting."
          >
            <Input
              className="admin-input"
              type="number"
              min={1}
              max={3650}
              value={cfg.consentExpiryDays}
              onChange={(e) =>
                onChange({ consentExpiryDays: Math.max(1, Math.min(3650, Number(e.target.value))) })
              }
            />
          </FieldRow>
        </div>
        <FieldRow
          label="Policy version"
          description="Increment this string when you update your privacy or cookie policy. Visitors who previously consented will be re-prompted (when the option below is enabled)."
        >
          <Input
            className="admin-input font-mono"
            value={cfg.policyVersion}
            onChange={(e) => onChange({ policyVersion: e.target.value })}
            maxLength={50}
            placeholder="1.0"
          />
        </FieldRow>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Re-show banner on policy update</p>
            <p className="text-xs text-slate-500">
              Visitors who already consented will see the banner again when the policy version changes.
            </p>
          </div>
          <Switch
            checked={cfg.reshowOnVersionChange}
            onCheckedChange={(v) => onChange({ reshowOnVersionChange: v })}
          />
        </div>
        <InfoBox>
          Under EU/EEA law, geo detection on the client side is not reliable without a server-side
          IP geolocation API. Setting "Global" ensures all visitors see the banner and is the
          safest choice for most deployments.
        </InfoBox>
      </TabsContent>
    </Tabs>
  );
}

// ── Builder Form ──────────────────────────────────────────────────────────────

function BuilderForm({
  cfg,
  onChange,
}: {
  cfg: NonNullable<ConsentConfigData['builder']>;
  onChange: (updates: Partial<NonNullable<ConsentConfigData['builder']>>) => void;
}) {
  const updateCfg = (updates: Partial<typeof cfg.providerConfig>) =>
    onChange({ providerConfig: { ...cfg.providerConfig, ...updates } });

  return (
    <div className="space-y-5">
      <InfoBox>
        CMP = cookie consent banner. Use this only when another service should show the banner
        and manage tracking consent. The native OrbitPage banner is disabled in External mode.
      </InfoBox>

      <WarnBox>
        External scripts are injected into the public page. Only paste code from a service you trust.
      </WarnBox>

      <FieldRow label="CMP provider" description="Choose a supported integration. Use Custom only when your provider is not listed.">
        <Select value={cfg.provider} onValueChange={(provider) => onChange({ provider: provider as typeof cfg.provider })}>
          <SelectTrigger className="admin-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="iubenda">iubenda</SelectItem>
            <SelectItem value="cookiebot">Cookiebot</SelectItem>
            <SelectItem value="cookieyes">CookieYes</SelectItem>
            <SelectItem value="onetrust">OneTrust</SelectItem>
            <SelectItem value="custom">Custom snippet</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {cfg.provider === 'iubenda' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Site ID" description="The site ID from your iubenda project.">
            <Input className="admin-input font-mono text-xs" value={cfg.providerConfig.siteId ?? ''} onChange={(e) => updateCfg({ siteId: e.target.value })} />
          </FieldRow>
          <FieldRow label="Cookie Policy ID" description="The Cookie Policy ID linked to the CMP.">
            <Input className="admin-input font-mono text-xs" value={cfg.providerConfig.cookiePolicyId ?? ''} onChange={(e) => updateCfg({ cookiePolicyId: e.target.value })} />
          </FieldRow>
        </div>
      )}

      {(cfg.provider === 'cookiebot' || cfg.provider === 'cookieyes') && (
        <FieldRow label={cfg.provider === 'cookiebot' ? 'Cookiebot CBID' : 'CookieYes script ID'} description="Copy the identifier from the provider installation code.">
          <Input className="admin-input font-mono text-xs" value={cfg.providerConfig.scriptId ?? ''} onChange={(e) => updateCfg({ scriptId: e.target.value })} />
        </FieldRow>
      )}

      {cfg.provider === 'onetrust' && (
        <FieldRow label="OneTrust domain script ID" description="The data-domain-script value from the OneTrust installation code.">
          <Input className="admin-input font-mono text-xs" value={cfg.providerConfig.siteId ?? ''} onChange={(e) => updateCfg({ siteId: e.target.value })} />
        </FieldRow>
      )}

      {cfg.provider === 'custom' && (
        <FieldRow label="CMP script" description="Paste the trusted installation snippet supplied by your CMP.">
          <Textarea
            className="admin-input min-h-[140px] resize-y font-mono text-xs"
            value={cfg.providerConfig.headSnippet ?? ''}
            onChange={(e) => updateCfg({ headSnippet: e.target.value, bodySnippet: '' })}
            placeholder="<script src=&quot;https://...&quot;></script>"
            maxLength={10000}
          />
        </FieldRow>
      )}
      <FieldRow
        label="Reopen selector (optional)"
        description='Optional CSS selector or JS expression that opens your provider preferences again. Example: ".cky-btn-revisit".'
      >
        <Input className="admin-input font-mono text-xs" value={cfg.reopenSelector}
          onChange={(e) => onChange({ reopenSelector: e.target.value })} maxLength={200}
          placeholder=".cky-btn-revisit" />
      </FieldRow>
    </div>
  );
}

// ── Mode Selector Card ────────────────────────────────────────────────────────

function ModeCard({
  mode,
  active,
  title,
  description,
  icon: Icon,
  badge,
  onClick,
}: {
  mode: ConsentMode;
  active: ConsentMode;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
  onClick: () => void;
}) {
  const isSelected = active === mode;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
              {title}
            </span>
            {badge && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-green-700">
                {badge}
              </span>
            )}
            {isSelected && (
              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-blue-500" />
            )}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export function PrivacySettings({
  privacyPolicyUrl,
  cookiePolicyUrl,
  onLegalPolicyUpdate,
  readOnly = false,
}: {
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  onLegalPolicyUpdate?: (links: { privacyPolicyUrl?: string; cookiePolicyUrl?: string }) => void | Promise<void>;
  readOnly?: boolean;
} = {}) {
  const { tr } = useAppI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [legalConfigLoaded, setLegalConfigLoaded] = useState(false);
  const [showLegalLinks, setShowLegalLinks] = useState(Boolean(privacyPolicyUrl || cookiePolicyUrl));
  const [privacyMethod, setPrivacyMethod] = useState<LegalPolicyMethod>(getPolicyMethod(privacyPolicyUrl, 'privacy'));
  const [cookieMethod, setCookieMethod] = useState<LegalPolicyMethod>(getPolicyMethod(cookiePolicyUrl, 'cookie'));
  const [privacyExternalUrl, setPrivacyExternalUrl] = useState(privacyPolicyUrl || '');
  const [cookieExternalUrl, setCookieExternalUrl] = useState(cookiePolicyUrl || '');
  const [privacyHostedText, setPrivacyHostedText] = useState('');
  const [cookieHostedText, setCookieHostedText] = useState('');
  const [privacyHostedFileName, setPrivacyHostedFileName] = useState('');
  const [cookieHostedFileName, setCookieHostedFileName] = useState('');
  const [privacyProviderConfig, setPrivacyProviderConfig] = useState('');
  const [cookieProviderConfig, setCookieProviderConfig] = useState('');

  const [mode, setMode] = useState<ConsentMode>('disabled');
  const [enabled, setEnabled] = useState(false);
  const [hardcoded, setHardcoded] =
    useState<NonNullable<ConsentConfigData['hardcoded']>>(DEFAULT_HARDCODED);
  const [builder, setBuilder] =
    useState<NonNullable<ConsentConfigData['builder']>>(DEFAULT_BUILDER);

  // Load config from backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await consentConfigApi.get();
        if (res?.data) {
          const { mode: m, enabled: e, legalPolicies: lp, hardcoded: h, builder: b } = res.data;
          setMode(m === 'builder' ? 'builder' : 'hardcoded');
          setEnabled(e ?? false);
          if (lp) {
            const privacyPolicy = { ...EMPTY_POLICY_CONFIG, ...lp.privacyPolicy };
            const cookiePolicy = { ...EMPTY_POLICY_CONFIG, ...lp.cookiePolicy };
            setShowLegalLinks(Boolean(lp.showFooterLinks));
            setPrivacyMethod(privacyPolicy.mode);
            setCookieMethod(cookiePolicy.mode);
            setPrivacyExternalUrl(privacyPolicy.mode === 'external' ? (privacyPolicy.externalUrl || privacyPolicyUrl || '') : '');
            setCookieExternalUrl(cookiePolicy.mode === 'external' ? (cookiePolicy.externalUrl || cookiePolicyUrl || '') : '');
            setPrivacyHostedText(privacyPolicy.mode === 'hosted' ? privacyPolicy.hostedText : '');
            setCookieHostedText(cookiePolicy.mode === 'hosted' ? cookiePolicy.hostedText : '');
            setPrivacyHostedFileName(privacyPolicy.mode === 'hosted' ? privacyPolicy.hostedFileName : '');
            setCookieHostedFileName(cookiePolicy.mode === 'hosted' ? cookiePolicy.hostedFileName : '');
            setPrivacyProviderConfig(privacyPolicy.mode === 'embedded' ? privacyPolicy.embeddedCode : '');
            setCookieProviderConfig(cookiePolicy.mode === 'embedded' ? cookiePolicy.embeddedCode : '');
            setLegalConfigLoaded(true);
          }
          if (h) setHardcoded({ ...DEFAULT_HARDCODED, ...h });
          if (b) setBuilder({ ...DEFAULT_BUILDER, ...b, providerConfig: { ...DEFAULT_BUILDER.providerConfig, ...b.providerConfig } });
        }
      } catch (err) {
        console.error('Failed to load consent config:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (legalConfigLoaded) return;
    setShowLegalLinks(Boolean(privacyPolicyUrl || cookiePolicyUrl));
    const nextPrivacyMethod = getPolicyMethod(privacyPolicyUrl, 'privacy');
    const nextCookieMethod = getPolicyMethod(cookiePolicyUrl, 'cookie');
    setPrivacyMethod(nextPrivacyMethod);
    setCookieMethod(nextCookieMethod);
    setPrivacyExternalUrl(nextPrivacyMethod === 'hosted' ? '' : (privacyPolicyUrl || ''));
    setCookieExternalUrl(nextCookieMethod === 'hosted' ? '' : (cookiePolicyUrl || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalConfigLoaded]);

  const changePolicyMethod = (kind: PolicyKind, nextMethod: LegalPolicyMethod) => {
    if (kind === 'privacy') {
      if (privacyMethod === nextMethod) return;
      setPrivacyMethod(nextMethod);
      setPrivacyExternalUrl('');
      setPrivacyHostedText('');
      setPrivacyHostedFileName('');
      setPrivacyProviderConfig('');
      return;
    }
    if (cookieMethod === nextMethod) return;
    setCookieMethod(nextMethod);
    setCookieExternalUrl('');
    setCookieHostedText('');
    setCookieHostedFileName('');
    setCookieProviderConfig('');
  };

  const changeConsentMode = (nextMode: Exclude<ConsentMode, 'disabled'>) => {
    setMode(nextMode);
    if (nextMode === 'hardcoded') {
      setBuilder(DEFAULT_BUILDER);
    }
  };

  const resolvedPrivacyPolicyUrl = useMemo(() => {
    if (!showLegalLinks) return undefined;
    if (privacyMethod === 'hosted') return HOSTED_POLICY_PATH.privacy;
    if (privacyMethod === 'embedded') return HOSTED_POLICY_PATH.privacy;
    return privacyExternalUrl.trim() || undefined;
  }, [privacyExternalUrl, privacyMethod, showLegalLinks]);

  const resolvedCookiePolicyUrl = useMemo(() => {
    if (!showLegalLinks) return undefined;
    if (cookieMethod === 'hosted') return HOSTED_POLICY_PATH.cookie;
    if (cookieMethod === 'embedded') return HOSTED_POLICY_PATH.cookie;
    return cookieExternalUrl.trim() || undefined;
  }, [cookieExternalUrl, cookieMethod, showLegalLinks]);

  const normalizedBuilder = useMemo(() => ({
    ...builder,
    providerConfig: {
      ...DEFAULT_BUILDER.providerConfig,
      ...builder.providerConfig,
    },
  }), [builder]);
  const privacySnapshot = useMemo(() => JSON.stringify({
    mode,
    enabled,
    hardcoded,
    builder: normalizedBuilder,
    legalPolicies: {
      showFooterLinks: showLegalLinks,
      privacyPolicy: {
        mode: privacyMethod,
        externalUrl: privacyMethod === 'external' ? (resolvedPrivacyPolicyUrl || '') : '',
        hostedText: privacyMethod === 'hosted' ? privacyHostedText.trim() : '',
        hostedFileName: privacyMethod === 'hosted' ? privacyHostedFileName : '',
        embeddedCode: privacyMethod === 'embedded' ? privacyProviderConfig.trim() : '',
      },
      cookiePolicy: {
        mode: cookieMethod,
        externalUrl: cookieMethod === 'external' ? (resolvedCookiePolicyUrl || '') : '',
        hostedText: cookieMethod === 'hosted' ? cookieHostedText.trim() : '',
        hostedFileName: cookieMethod === 'hosted' ? cookieHostedFileName : '',
        embeddedCode: cookieMethod === 'embedded' ? cookieProviderConfig.trim() : '',
      },
    },
  }), [
    cookieHostedFileName,
    cookieHostedText,
    cookieMethod,
    cookieProviderConfig,
    enabled,
    hardcoded,
    mode,
    normalizedBuilder,
    privacyHostedFileName,
    privacyHostedText,
    privacyMethod,
    privacyProviderConfig,
    resolvedCookiePolicyUrl,
    resolvedPrivacyPolicyUrl,
    showLegalLinks,
  ]);
  const isDirty = savedSnapshot !== null && savedSnapshot !== privacySnapshot;

  useEffect(() => {
    if (loading || savedSnapshot !== null) return;
    const timer = window.setTimeout(() => setSavedSnapshot(privacySnapshot), 0);
    return () => window.clearTimeout(timer);
  }, [loading, privacySnapshot, savedSnapshot]);

  const handleSave = async () => {
    if (readOnly || !isDirty || saving) return;

    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const nextPrivacyPolicyUrl = resolvedPrivacyPolicyUrl;
      const nextCookiePolicyUrl = resolvedCookiePolicyUrl;

      if (mode === 'hardcoded' && enabled && !nextPrivacyPolicyUrl && !nextCookiePolicyUrl) {
        setSaveError('Add at least one legal policy link before enabling the native banner.');
        return;
      }

      if (!isValidPolicyUrl(nextPrivacyPolicyUrl || '')) {
        setSaveError('Privacy Policy URL must be a relative path, http:// URL, or https:// URL.');
        return;
      }
      if (!isValidPolicyUrl(nextCookiePolicyUrl || '')) {
        setSaveError('Cookie Policy URL must be a relative path, http:// URL, or https:// URL.');
        return;
      }

      if (showLegalLinks && privacyMethod === 'hosted' && !privacyHostedText.trim()) {
        setSaveError('Add Privacy Policy text or choose another source.');
        return;
      }
      if (showLegalLinks && cookieMethod === 'hosted' && !cookieHostedText.trim()) {
        setSaveError('Add Cookie Policy text or choose another source.');
        return;
      }
      if (showLegalLinks && privacyMethod === 'embedded' && !privacyProviderConfig.trim()) {
        setSaveError('Paste the Privacy Policy embed code or choose another source.');
        return;
      }
      if (showLegalLinks && cookieMethod === 'embedded' && !cookieProviderConfig.trim()) {
        setSaveError('Paste the Cookie Policy embed code or choose another source.');
        return;
      }
      if (mode === 'builder' && enabled && !isBuilderProviderConfigured(builder)) {
        setSaveError('Complete the required configuration for the selected CMP provider.');
        return;
      }

      await onLegalPolicyUpdate?.({
        privacyPolicyUrl: nextPrivacyPolicyUrl,
        cookiePolicyUrl: nextCookiePolicyUrl,
      });

      const nextBuilder = normalizedBuilder;
      const legalPolicies: NonNullable<ConsentConfigData['legalPolicies']> = {
        showFooterLinks: showLegalLinks,
        privacyPolicy: {
          mode: privacyMethod,
          externalUrl: privacyMethod === 'external' ? (nextPrivacyPolicyUrl || '') : '',
          hostedText: privacyMethod === 'hosted' ? privacyHostedText.trim() : '',
          hostedFileName: privacyMethod === 'hosted' ? privacyHostedFileName : '',
          embeddedCode: privacyMethod === 'embedded' ? privacyProviderConfig.trim() : '',
        },
        cookiePolicy: {
          mode: cookieMethod,
          externalUrl: cookieMethod === 'external' ? (nextCookiePolicyUrl || '') : '',
          hostedText: cookieMethod === 'hosted' ? cookieHostedText.trim() : '',
          hostedFileName: cookieMethod === 'hosted' ? cookieHostedFileName : '',
          embeddedCode: cookieMethod === 'embedded' ? cookieProviderConfig.trim() : '',
        },
      };

      const res = await consentConfigApi.update({ mode, enabled, legalPolicies, hardcoded, builder: nextBuilder });
      if (!res.success) {
        setSaveError((res as { error?: string }).error || 'Save failed.');
      } else {
        setBuilder(nextBuilder);
        setSavedSnapshot(privacySnapshot);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err: unknown) {
      setSaveError(
        (err instanceof Error && err.message) === 'AUTH_EXPIRED'
          ? 'Your session expired. Open Admin in another tab, sign in again, then return here and click Save changes. Your edits are still on this page.'
          : (err instanceof Error ? err.message : 'An unexpected error occurred.')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const activeLabel = mode === 'hardcoded' ? tr('Native banner', 'Banner nativo') : mode === 'builder' ? 'CMP esterna' : null;

  return (
    <div className="admin-single-column space-y-6">
      {/* Header */}
      <section className="admin-panel">
        <div className="mb-4 flex items-center gap-3">
          <span className="admin-panel-icon">
            <Cookie className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Privacy &amp; Cookies</h2>
            <p className="text-xs leading-5 text-slate-500">
              {tr("Legal pages are your documents. Consent management is the cookie banner.", "Le pagine legali sono i tuoi documenti. La gestione del consenso è il banner cookie.")}
            </p>
          </div>
        </div>

        {/* Status bar */}
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
          enabled
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
            enabled ? 'bg-green-500' : 'bg-slate-400'
          }`} />
          {enabled
            ? `${tr("Active", "Attivo")} - ${activeLabel} ${tr("is live on the public page", "è online sulla pagina pubblica")}`
            : tr('Cookie consent is disabled - no banner is shown', 'Il consenso cookie è disabilitato: non viene mostrato alcun banner')}
        </div>
        {readOnly && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            {tr("Demo mode is active. Privacy Policy, Cookie Policy, Consent Management, and related compliance settings are view-only.", "La modalità demo è attiva. Privacy Policy, Cookie Policy, gestione del consenso e impostazioni collegate sono in sola lettura.")}
          </div>
        )}
      </section>

      <fieldset disabled={readOnly} className={`m-0 min-w-0 space-y-6 border-0 p-0 ${readOnly ? 'opacity-75' : ''}`}>
        <section className="admin-panel space-y-3">
          <SectionHeader
            icon={Globe2}
            title={tr("Legal pages", "Pagine legali")}
            description={tr("Privacy Policy = legal document. Cookie Policy = cookie document.", "Privacy Policy = documento sulla privacy. Cookie Policy = documento sui cookie.")}
          />
          <LegalPoliciesForm
            showLegalLinks={showLegalLinks}
            onShowLegalLinksChange={setShowLegalLinks}
            privacy={{
              method: privacyMethod,
              externalUrl: privacyExternalUrl,
              hostedText: privacyHostedText,
              hostedFileName: privacyHostedFileName,
              providerConfig: privacyProviderConfig,
              onMethodChange: (method) => changePolicyMethod('privacy', method),
              onExternalUrlChange: setPrivacyExternalUrl,
              onHostedTextChange: setPrivacyHostedText,
              onHostedFileNameChange: setPrivacyHostedFileName,
              onProviderConfigChange: setPrivacyProviderConfig,
            }}
            cookie={{
              method: cookieMethod,
              externalUrl: cookieExternalUrl,
              hostedText: cookieHostedText,
              hostedFileName: cookieHostedFileName,
              providerConfig: cookieProviderConfig,
              onMethodChange: (method) => changePolicyMethod('cookie', method),
              onExternalUrlChange: setCookieExternalUrl,
              onHostedTextChange: setCookieHostedText,
              onHostedFileNameChange: setCookieHostedFileName,
              onProviderConfigChange: setCookieProviderConfig,
            }}
          />
        </section>

        <section className="admin-panel space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeader
              icon={ShieldCheck}
              title={tr("Consent management", "Gestione consenso")}
              description={tr("CMP = cookie consent banner. Choose who shows it.", "CMP = banner per il consenso cookie. Scegli chi lo mostra.")}
            />
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-500">{enabled ? tr('Live', 'Online') : tr('Off', 'Disattivo')}</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={tr("Enable consent management", "Abilita gestione consenso")} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              mode="hardcoded"
              active={mode}
              title={tr("Native (OrbitPage built-in)", "Nativo (integrato in OrbitPage)")}
              description={tr("OrbitPage shows the cookie banner. No external script is loaded.", "OrbitPage mostra il banner cookie. Non viene caricato alcuno script esterno.")}
              icon={ShieldCheck}
              badge={tr("Recommended", "Consigliato")}
              onClick={() => changeConsentMode('hardcoded')}
            />
            <ModeCard
              mode="builder"
              active={mode}
              title={tr("External (custom script)", "Esterno (script personalizzato)")}
              description={tr("Your provider shows the banner. OrbitPage banner stays off.", "Il provider mostra il banner; quello OrbitPage resta disattivato.")}
              icon={Globe2}
              onClick={() => changeConsentMode('builder')}
            />
          </div>

          {mode === 'hardcoded' && enabled && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <SectionHeader
                icon={ShieldCheck}
                title={tr("Native banner settings", "Impostazioni banner nativo")}
                description={tr("Customise the built-in consent banner shown to visitors.", "Personalizza il banner del consenso mostrato ai visitatori.")}
              />
              <HardcodedForm
                cfg={hardcoded}
                onChange={(u) => setHardcoded((prev) => ({ ...prev, ...u }))}
              />
            </div>
          )}

          {mode === 'builder' && enabled && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <SectionHeader
                icon={Globe2}
                title={tr("External CMP script", "Script CMP esterna")}
                description={tr("Paste the script from the service that will show your cookie banner.", "Incolla lo script del servizio che mostrerà il banner cookie.")}
              />
              <BuilderForm
                cfg={builder}
                onChange={(u) => setBuilder((prev) => ({ ...prev, ...u }))}
              />
            </div>
          )}
        </section>
      </fieldset>
      {/* Compliance checklist */}
      <section className="admin-panel space-y-3">
        <SectionHeader
          icon={ListChecks}
          title={tr("GDPR / ePrivacy compliance checklist", "Verifica conformità GDPR / ePrivacy")}
          description={tr("Review before enabling. This is guidance, not legal advice — consult a lawyer for your specific situation.", "Controlla prima di abilitare. Queste sono indicazioni, non consulenza legale: rivolgiti a un professionista per il tuo caso.")}
        />
        {[
          {
            // Page-level URLs are persisted as the source of truth.
            ok: !!(resolvedPrivacyPolicyUrl || resolvedCookiePolicyUrl),
            text: tr('At least one legal page is configured', 'È configurata almeno una pagina legale'),
          },
          {
            ok: mode === 'hardcoded'
              ? Object.values(hardcoded.categories).every(
                  (c) => !c.enabled || !!c.description?.trim(),
                )
              : true,
            text: tr('All enabled categories have descriptions', 'Tutte le categorie abilitate hanno una descrizione'),
          },
          {
            ok: mode === 'hardcoded' || isBuilderProviderConfigured(builder),
            text: mode === 'hardcoded' ? tr('Native banner is selected', 'È selezionato il banner nativo') : tr('External CMP script is configured', 'Lo script CMP esterno è configurato'),
          },
          {
            ok: enabled,
            text: tr('The selected mode is enabled and will run on the public page', 'La modalità selezionata è abilitata e verrà eseguita sulla pagina pubblica'),
          },
          {
            ok: true,
            text: tr('"Reject all" and "Accept all" receive equal visual weight in the banner', '"Rifiuta tutto" e "Accetta tutto" hanno lo stesso peso visivo nel banner'),
          },
          {
            ok: true,
            text: tr('Necessary cookies are always active and cannot be disabled by visitors', 'I cookie necessari sono sempre attivi e non possono essere disabilitati dai visitatori'),
          },
          {
            ok: true,
            text: tr('Consent is stored with timestamp, policy version, and category flags', 'Il consenso viene salvato con data, versione della policy e categorie'),
          },
          {
            ok: enabled && mode !== 'disabled',
            text: tr('Tracking blocked until consent is granted — Google Analytics is gated behind analytics consent (GCM v2)', 'Il monitoraggio resta bloccato fino al consenso; Google Analytics richiede il consenso analytics (GCM v2)'),
          },
          {
            ok: true,
            text: tr('A persistent "Cookie preferences" link allows users to revise choices at any time', 'Il link persistente "Preferenze cookie" consente di modificare le scelte in qualsiasi momento'),
          },
        ].map(({ ok, text }) => (
          <div key={text} className="flex items-start gap-2.5 text-xs text-slate-700">
            <span className={`mt-0.5 shrink-0 text-base leading-none ${ok ? 'text-green-500' : 'text-slate-300'}`}>
              {ok ? '✓' : '○'}
            </span>
            <span className={ok ? 'text-slate-700' : 'text-slate-400'}>{text}</span>
          </div>
        ))}
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <div>
          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {tr("Saved successfully", "Salvato correttamente")}
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving || readOnly}
          className="admin-action admin-action-primary"
          size="sm"
        >
          {saving ? tr('Saving…', 'Salvataggio…') : saveSuccess ? tr('Saved', 'Salvato') : tr('Save changes', 'Salva modifiche')}
        </Button>
      </div>
    </div>
  );
}
