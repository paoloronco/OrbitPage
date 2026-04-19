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
import { consentConfigApi, type ConsentConfigData } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConsentMode = 'disabled' | 'hardcoded' | 'builder';
type Provider = 'iubenda' | 'cookiebot' | 'cookieyes' | 'onetrust' | 'custom';
type LegalPolicyMethod = 'external' | 'hosted' | 'provider';
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
  provider: 'iubenda',
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

// ── Provider help text ────────────────────────────────────────────────────────

const PROVIDER_INFO: Record<Provider, { label: string; help: string }> = {
  iubenda: {
    label: 'Iubenda',
    help: 'Find your Site ID and Cookie Policy ID in Iubenda → Websites & Apps → select site → Cookie solution.',
  },
  cookiebot: {
    label: 'Cookiebot',
    help: 'Find your Script ID (cbid) in Cookiebot → Your scripts → copy the data-cbid value.',
  },
  cookieyes: {
    label: 'CookieYes',
    help: 'Find your Script ID in CookieYes dashboard → Cookie scanner → embed script → copy the ID from the script URL.',
  },
  onetrust: {
    label: 'OneTrust',
    help: 'Find your Data Domain Script ID in OneTrust → Websites → select domain → Scripts.',
  },
  custom: {
    label: 'Custom snippet',
    help: 'Paste the HTML/JS snippet provided by your CMP. Head snippet loads before the closing </head> tag. Body snippet loads before </body>.',
  },
};

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

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || '';
}

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
    method === 'provider' ? extractFirstUrl(providerConfig) :
    externalUrl.trim();
  const configured = !!resolvedUrl;

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
            title="Host it in Lynx"
            description={`Use the built-in ${hostedPath} page.`}
            onClick={() => onMethodChange('hosted')}
          />
          <MethodButton
            active={method === 'provider'}
            icon={Sliders}
            title="External provider"
            description="Advanced setup for a privacy service."
            onClick={() => onMethodChange('provider')}
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
          <InfoBox>Lynx will generate a public page at {hostedPath}</InfoBox>
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
          <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 underline" href={hostedPath} target="_blank" rel="noopener noreferrer">
            Preview {hostedPath}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {method === 'provider' && (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Advanced — for Usercentrics, iubenda, etc.
          </summary>
          <div className="mt-3 space-y-3">
            <FieldRow label="Provider script or config" description="Paste the provider code here. Lynx will use the first web address it finds for the footer link.">
              <Textarea
                className="admin-input min-h-[120px] resize-y font-mono text-xs"
                value={providerConfig}
                onChange={(e) => onProviderConfigChange(e.target.value)}
                placeholder="<script src=&quot;https://...&quot;></script>"
              />
            </FieldRow>
            {resolvedUrl ? (
              <p className="break-all text-xs text-green-700">Link found: {resolvedUrl}</p>
            ) : (
              <p className="text-xs text-amber-700">Missing: paste a web address from your provider.</p>
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
            <a className="inline-flex items-center gap-1 text-blue-700 underline" href="/privacy" target="_blank" rel="noopener noreferrer">
              /privacy <ExternalLink className="h-3 w-3" />
            </a>
            <a className="inline-flex items-center gap-1 text-blue-700 underline" href="/cookies" target="_blank" rel="noopener noreferrer">
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
  const provider = cfg.provider;
  const info = PROVIDER_INFO[provider];
  const updateCfg = (updates: Partial<typeof cfg.providerConfig>) =>
    onChange({ providerConfig: { ...cfg.providerConfig, ...updates } });

  return (
    <div className="space-y-5">
      <InfoBox>
        Builder mode delegates all consent UI to an external Consent Management Platform (CMP).
        The native Lynx banner is disabled when this mode is active. The external CMP script
        loads only when builder mode is enabled.
      </InfoBox>

      <FieldRow label="CMP provider">
        <Select
          value={provider}
          onValueChange={(v: Provider) => onChange({ provider: v })}
        >
          <SelectTrigger className="admin-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PROVIDER_INFO) as [Provider, { label: string }][]).map(
              ([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs leading-5 text-blue-700">{info.help}</p>
      </FieldRow>

      {/* Provider-specific fields */}
      {provider === 'iubenda' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Site ID" description="Numeric ID from your Iubenda dashboard.">
            <Input className="admin-input font-mono" value={cfg.providerConfig.siteId ?? ''}
              onChange={(e) => updateCfg({ siteId: e.target.value })} placeholder="1234567" maxLength={200} />
          </FieldRow>
          <FieldRow label="Cookie Policy ID" description="Numeric cookie policy document ID.">
            <Input className="admin-input font-mono" value={cfg.providerConfig.cookiePolicyId ?? ''}
              onChange={(e) => updateCfg({ cookiePolicyId: e.target.value })} placeholder="89012345" maxLength={200} />
          </FieldRow>
        </div>
      )}

      {(provider === 'cookiebot' || provider === 'cookieyes') && (
        <FieldRow
          label={provider === 'cookiebot' ? 'Script ID (cbid)' : 'Script ID'}
          description={
            provider === 'cookiebot'
              ? 'The data-cbid value from your Cookiebot embed snippet.'
              : 'The ID segment from your CookieYes CDN script URL.'
          }
        >
          <Input className="admin-input font-mono" value={cfg.providerConfig.scriptId ?? ''}
            onChange={(e) => updateCfg({ scriptId: e.target.value })} maxLength={200} />
        </FieldRow>
      )}

      {provider === 'onetrust' && (
        <FieldRow label="Data Domain Script ID" description="The data-domain-script value from OneTrust.">
          <Input className="admin-input font-mono" value={cfg.providerConfig.siteId ?? ''}
            onChange={(e) => updateCfg({ siteId: e.target.value })} maxLength={200} />
        </FieldRow>
      )}

      {provider === 'custom' && (
        <div className="space-y-4">
          <WarnBox>
            Custom snippets are injected verbatim into the page. Only paste code from sources you
            trust. These snippets are stored server-side and served only to authenticated sessions —
            they are never exposed to unauthenticated visitors in configuration form.
          </WarnBox>
          <FieldRow
            label="Head snippet"
            description="Injected into <head> before the page is loaded. Typically the main CMP script tag."
          >
            <Textarea
              className="admin-input min-h-[100px] resize-y font-mono text-xs"
              value={cfg.providerConfig.headSnippet ?? ''}
              onChange={(e) => updateCfg({ headSnippet: e.target.value })}
              placeholder="<!-- Paste your CMP <script> tag here -->"
              maxLength={10000}
            />
          </FieldRow>
          <FieldRow
            label="Body snippet"
            description="Injected at the end of <body>. Optional — only if your CMP requires it."
          >
            <Textarea
              className="admin-input min-h-[80px] resize-y font-mono text-xs"
              value={cfg.providerConfig.bodySnippet ?? ''}
              onChange={(e) => updateCfg({ bodySnippet: e.target.value })}
              placeholder="<!-- Optional body snippet -->"
              maxLength={10000}
            />
          </FieldRow>
        </div>
      )}

      <FieldRow
        label="Reopen selector (optional)"
        description='CSS selector or JS expression your CMP exposes to re-open the consent UI. E.g. ".iubenda-cs-preferences-link" or "window._iub?.cs?.api?.openPreferences()". Used by external integrations.'
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
}: {
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  onLegalPolicyUpdate?: (links: { privacyPolicyUrl?: string; cookiePolicyUrl?: string }) => void | Promise<void>;
} = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
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
          const { mode: m, enabled: e, hardcoded: h, builder: b } = res.data;
          setMode(m ?? 'disabled');
          setEnabled(e ?? false);
          if (h) setHardcoded({ ...DEFAULT_HARDCODED, ...h });
          if (b) setBuilder({ ...DEFAULT_BUILDER, ...b });
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
    setShowLegalLinks(Boolean(privacyPolicyUrl || cookiePolicyUrl));
    const nextPrivacyMethod = getPolicyMethod(privacyPolicyUrl, 'privacy');
    const nextCookieMethod = getPolicyMethod(cookiePolicyUrl, 'cookie');
    setPrivacyMethod(nextPrivacyMethod);
    setCookieMethod(nextCookieMethod);
    setPrivacyExternalUrl(nextPrivacyMethod === 'hosted' ? '' : (privacyPolicyUrl || ''));
    setCookieExternalUrl(nextCookieMethod === 'hosted' ? '' : (cookiePolicyUrl || ''));
  }, [privacyPolicyUrl, cookiePolicyUrl]);

  const resolvedPrivacyPolicyUrl = useMemo(() => {
    if (!showLegalLinks) return undefined;
    if (privacyMethod === 'hosted') return HOSTED_POLICY_PATH.privacy;
    if (privacyMethod === 'provider') return extractFirstUrl(privacyProviderConfig) || undefined;
    return privacyExternalUrl.trim() || undefined;
  }, [privacyExternalUrl, privacyMethod, privacyProviderConfig, showLegalLinks]);

  const resolvedCookiePolicyUrl = useMemo(() => {
    if (!showLegalLinks) return undefined;
    if (cookieMethod === 'hosted') return HOSTED_POLICY_PATH.cookie;
    if (cookieMethod === 'provider') return extractFirstUrl(cookieProviderConfig) || undefined;
    return cookieExternalUrl.trim() || undefined;
  }, [cookieExternalUrl, cookieMethod, cookieProviderConfig, showLegalLinks]);

  const handleSave = async () => {
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

      await onLegalPolicyUpdate?.({
        privacyPolicyUrl: nextPrivacyPolicyUrl,
        cookiePolicyUrl: nextCookiePolicyUrl,
      });

      const res = await consentConfigApi.update({ mode, enabled, hardcoded, builder });
      if (!res.success) {
        setSaveError((res as any).error || 'Save failed.');
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err: any) {
      setSaveError(err?.message || 'An unexpected error occurred.');
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

  const activeLabel = mode === 'hardcoded' ? 'Native banner' : mode === 'builder' ? 'External builder' : null;

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
              Configure your cookie consent solution. Modes are mutually exclusive — only one can be
              active at a time.
            </p>
          </div>
        </div>

        {/* Status bar */}
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
          mode !== 'disabled' && enabled
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
            mode !== 'disabled' && enabled ? 'bg-green-500' : 'bg-slate-400'
          }`} />
          {mode !== 'disabled' && enabled
            ? `Active — ${activeLabel} is live on the public page`
            : mode !== 'disabled'
              ? `${activeLabel} is configured but not yet enabled`
              : 'Cookie consent is disabled — non-essential scripts load without consent checks'}
        </div>
      </section>

      {/* Mode selector */}
      <section className="admin-panel space-y-3">
        <SectionHeader icon={ShieldCheck} title="Consent mode" description="Choose how cookie consent is managed on your public page." />
        <div className="grid gap-3 sm:grid-cols-3">
          <ModeCard
            mode="disabled"
            active={mode}
            title="Disabled"
            description="No banner shown. Scripts load without consent checks."
            icon={Cookie}
            onClick={() => setMode('disabled')}
          />
          <ModeCard
            mode="hardcoded"
            active={mode}
            title="Native banner"
            description="Built-in cookie banner with full customisation. No external dependencies."
            icon={ShieldCheck}
            badge="Recommended"
            onClick={() => setMode('hardcoded')}
          />
          <ModeCard
            mode="builder"
            active={mode}
            title="External builder"
            description="Delegate to Iubenda, Cookiebot, CookieYes, OneTrust, or a custom CMP."
            icon={Globe2}
            onClick={() => setMode('builder')}
          />
        </div>

        {mode === 'hardcoded' && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <SectionHeader
                icon={ShieldCheck}
                title="Native banner configuration"
                description="Customise the built-in consent banner shown to your visitors."
              />
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-500">{enabled ? 'Live' : 'Draft'}</span>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  aria-label="Enable native banner"
                />
              </div>
            </div>

            {!enabled && (
              <WarnBox>
                The banner is in draft. Enable it above to make it visible on your public page. Save
                your changes after enabling.
              </WarnBox>
            )}

            <HardcodedForm
              cfg={hardcoded}
              onChange={(u) => setHardcoded((prev) => ({ ...prev, ...u }))}
            />
          </div>
        )}
      </section>

      <section className="admin-panel space-y-3">
        <SectionHeader
          icon={Globe2}
          title="Legal policies"
          description="Manage the policy links used across your public page and cookie banner."
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
            onMethodChange: setPrivacyMethod,
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
            onMethodChange: setCookieMethod,
            onExternalUrlChange: setCookieExternalUrl,
            onHostedTextChange: setCookieHostedText,
            onHostedFileNameChange: setCookieHostedFileName,
            onProviderConfigChange: setCookieProviderConfig,
          }}
        />
      </section>

      {/* Builder config */}
      {mode === 'builder' && (
        <section className="admin-panel">
          <div className="mb-4 flex items-center justify-between gap-4">
            <SectionHeader
              icon={Globe2}
              title="External CMP configuration"
              description="Connect your chosen Consent Management Platform."
            />
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-500">{enabled ? 'Live' : 'Draft'}</span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Enable builder integration"
              />
            </div>
          </div>

          {!enabled && (
            <WarnBox>
              The integration is in draft mode. Enable it above to inject the CMP script on your
              public page.
            </WarnBox>
          )}

          <BuilderForm
            cfg={builder}
            onChange={(u) => setBuilder((prev) => ({ ...prev, ...u }))}
          />
        </section>
      )}

      {/* Compliance checklist */}
      <section className="admin-panel space-y-3">
        <SectionHeader
          icon={ListChecks}
          title="GDPR / ePrivacy compliance checklist"
          description="Review before enabling. This is guidance, not legal advice — consult a lawyer for your specific situation."
        />
        {[
          {
            // Profile-level URLs are persisted as the source of truth.
            ok: mode === 'hardcoded'
              ? !!(resolvedPrivacyPolicyUrl || resolvedCookiePolicyUrl)
              : mode === 'builder',
            text: 'At least one policy URL is configured in Legal policies',
          },
          {
            ok: mode === 'hardcoded'
              ? Object.values(hardcoded.categories).every(
                  (c) => !c.enabled || !!c.description?.trim(),
                )
              : true,
            text: 'All enabled categories have descriptions',
          },
          {
            ok: mode !== 'disabled',
            text: 'A consent mode is selected (not "Disabled")',
          },
          {
            ok: enabled && mode !== 'disabled',
            text: 'The selected mode is enabled and will run on the public page',
          },
          {
            ok: true,
            text: '"Reject all" and "Accept all" receive equal visual weight in the banner',
          },
          {
            ok: true,
            text: 'Necessary cookies are always active and cannot be disabled by visitors',
          },
          {
            ok: true,
            text: 'Consent is stored with timestamp, policy version, and category flags',
          },
          {
            ok: true,
            text: 'Google Analytics is blocked until analytics consent is granted (GCM v2)',
          },
          {
            ok: true,
            text: 'A persistent "Cookie preferences" link allows users to revise choices at any time',
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
              Saved successfully
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="admin-action admin-action-primary"
          size="sm"
        >
          {saving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
