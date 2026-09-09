export const MAX_HOSTED_BACKUP_FILE_BYTES = 256 * 1024 * 1024;
export const MAX_MANAGED_BACKUP_PAYLOAD_BYTES = 2 * 1024 * 1024;

const MANAGED_BACKUP_FORMAT = 'orbitpage-managed-page';
export const BACKUP_SECTION_IDS = [
  'profile',
  'links',
  'pages',
  'theme',
  'menu',
  'privacy',
  'discovery',
  'accounts',
  'media',
] as const;
const LEGACY_MANAGED_BACKUP_SECTION_IDS = ['profile', 'links', 'theme', 'privacy'] as const;
export const MANAGED_BACKUP_SECTION_IDS = [...LEGACY_MANAGED_BACKUP_SECTION_IDS, 'pages', 'menu', 'discovery'] as const;
export type BackupSectionId = typeof BACKUP_SECTION_IDS[number];
const ALLOWED_MEDIA_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

type JsonRecord = Record<string, unknown>;
type MediaPurpose = 'background' | 'content' | 'cover' | 'icon' | 'profile';

type OssUpload = {
  path: string;
  data: string;
};

export type HostedBackupMedia = {
  base64: string;
  fileName: string;
  mimeType: string;
  purpose: MediaPurpose;
  slot: string;
};

export type HostedBackupImportResult = {
  backup: JsonRecord;
  source: 'managed' | 'self-hosted';
  migratedMedia: number;
  skippedUploads: number;
};

export type OrbitPageBackupInspection = {
  source: 'managed' | 'self-hosted';
  sections: BackupSectionId[];
};

type HostedBackupMediaUploader = (media: HostedBackupMedia) => Promise<string>;

const isRecord = (value: unknown): value is JsonRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const optionalString = (value: unknown) => typeof value === 'string' ? value : null;
const requiredString = (value: unknown) => typeof value === 'string' ? value : '';
const optionalNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

function parseJsonRecord(value: unknown) {
  const parsed = typeof value === 'string' ? parseJson(value, {}) : value;
  return isRecord(parsed) ? parsed : {};
}

function parseJsonArray(value: unknown) {
  const parsed = typeof value === 'string' ? parseJson(value, []) : value;
  return Array.isArray(parsed) ? parsed : [];
}

function mapProfile(row: JsonRecord) {
  return {
    name: requiredString(row.name),
    bio: requiredString(row.bio),
    avatar: requiredString(row.avatar),
    social_links: parseJsonRecord(row.social_links),
    show_avatar: row.show_avatar === 0 ? 0 : 1,
    name_font_size: optionalString(row.name_font_size),
    bio_font_size: optionalString(row.bio_font_size),
    tab_title: optionalString(row.tab_title),
    meta_description: optionalString(row.meta_description),
    footer_text: optionalString(row.footer_text),
    favicon: optionalString(row.favicon),
    google_analytics_id: optionalString(row.google_analytics_id),
    privacy_policy_url: optionalString(row.privacy_policy_url),
    cookie_policy_url: optionalString(row.cookie_policy_url),
    admin_onboarding_enabled: row.admin_onboarding_enabled === 1 || row.admin_onboarding_enabled === true,
    appearance: parseJsonRecord(row.appearance),
  } satisfies JsonRecord;
}

function mapLink(row: JsonRecord, index: number) {
  return {
    id: String(row.id || `imported-${index + 1}`),
    title: requiredString(row.title),
    description: requiredString(row.description),
    url: requiredString(row.url),
    hideUrl: row.hide_url === 1 || row.hide_url === true,
    type: requiredString(row.type) || 'link',
    icon: optionalString(row.icon),
    iconType: optionalString(row.icon_type),
    backgroundColor: optionalString(row.background_color),
    textColor: optionalString(row.text_color),
    surfaceEffect: optionalString(row.surface_effect),
    size: optionalString(row.size),
    content: optionalString(row.content),
    textItems: parseJsonArray(row.text_items),
    titleFontFamily: optionalString(row.title_font_family),
    descriptionFontFamily: optionalString(row.description_font_family),
    alignment: optionalString(row.text_alignment),
    titleFontSize: optionalString(row.title_font_size),
    descriptionFontSize: optionalString(row.description_font_size),
    isActive: row.is_active !== 0 && row.is_active !== false,
    clickCount: optionalNumber(row.click_count) || 0,
    ctaAction: optionalString(row.cta_action),
    ctaClicks: optionalNumber(row.cta_click_count) || 0,
    status: optionalString(row.status) || 'live',
    campaignName: optionalString(row.campaign_name),
    startDate: optionalString(row.start_date),
    startTime: optionalString(row.start_time),
    endDate: optionalString(row.end_date),
    endTime: optionalString(row.end_time),
    timezone: optionalString(row.timezone),
    availability: row.availability === 'unavailable' ? 'unavailable' : 'available',
    coverImage: optionalString(row.cover_image),
    coverImageAlt: optionalString(row.cover_image_alt),
    position: index,
  } satisfies JsonRecord;
}

function mapTheme(row: JsonRecord) {
  const fullConfig = parseJsonRecord(row.full_config);
  if (Object.keys(fullConfig).length > 0) return fullConfig;
  return {
    primary: optionalString(row.primary_color),
    background: optionalString(row.background_color),
    foreground: optionalString(row.text_color),
    buttonStyle: optionalString(row.button_style),
  } satisfies JsonRecord;
}

function mapConsentConfig(row: JsonRecord) {
  const fullConfig = parseJsonRecord(row.full_config);
  if (Object.keys(fullConfig).length > 0) return fullConfig;
  return {
    mode: optionalString(row.mode) || 'builder',
    enabled: row.enabled !== 0 && row.enabled !== false,
  } satisfies JsonRecord;
}

function mapTextFiles(rows: JsonRecord[]) {
  const builtInPaths: Record<string, string> = {
    robots: '/robots.txt',
    llms: '/llms.txt',
    humans: '/humans.txt',
    security: '/.well-known/security.txt',
    ai: '/ai.txt',
  };
  return rows.flatMap((row) => {
    const originalKey = requiredString(row.file_key);
    const isCustom = row.is_custom === 1 || row.is_custom === true;
    const path = isCustom ? requiredString(row.file_path).toLowerCase() : builtInPaths[originalKey];
    if (!path || typeof row.content !== 'string') return [];
    const updatedAt = typeof row.updated_at === 'string' && !Number.isNaN(Date.parse(row.updated_at))
      ? row.updated_at
      : new Date(0).toISOString();
    return [{
      key: originalKey,
      path,
      content: row.content,
      isCustom,
      createdAt: updatedAt,
      updatedAt,
    }];
  });
}

function mapSitemap(rows: JsonRecord[]) {
  const generatedAt = rows[0]?.generated_at;
  return typeof generatedAt === 'string' && !Number.isNaN(Date.parse(generatedAt))
    ? { generatedAt }
    : undefined;
}

function normalizeUploadPath(value: string) {
  let pathname = value.trim();
  if (!pathname) return null;

  try {
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
      if (!pathname.toLowerCase().includes('/uploads/')) return null;
    }
  } catch {
    return null;
  }

  pathname = pathname.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  const marker = pathname.toLowerCase().indexOf('uploads/');
  if (marker >= 0) pathname = pathname.slice(marker + 'uploads/'.length);

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (!pathname || pathname.includes('\\') || pathname.split('/').some((part) => part === '..')) return null;
  return pathname;
}

function mimeTypeForPath(path: string) {
  const extension = path.toLowerCase().split('.').pop();
  if (extension === 'avif') return 'image/avif';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  return null;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/avif') return 'avif';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  return 'bin';
}

function normalizeSlot(path: Array<string | number>) {
  const suffix = path.join('-')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 78) || 'media';
  return `backup-import-${suffix}`;
}

function purposeForPath(path: Array<string | number>): MediaPurpose {
  const normalized = path.join('.').toLowerCase();
  if (normalized.includes('backgroundmedia')) return 'background';
  if (normalized.includes('coverimage') || normalized.includes('posterurl')) return 'cover';
  if (normalized.includes('avatar')) return 'profile';
  if (normalized.includes('favicon') || normalized.endsWith('.icon')) return 'icon';
  return 'content';
}

function isMediaPath(path: Array<string | number>) {
  const field = String(path[path.length - 1] || '').toLowerCase();
  return field === 'avatar' || field === 'favicon' || field === 'icon' ||
    field === 'coverimage' || field === 'mediaurl' || field === 'posterurl' || field === 'imageurl';
}

function parseDataUrl(value: string) {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(value);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2].replace(/[\r\n]/g, '') };
}

function asUploadMap(input: unknown) {
  const uploads = Array.isArray(input) ? input : [];
  const map = new Map<string, OssUpload>();
  for (const entry of uploads) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.data !== 'string') continue;
    const path = normalizeUploadPath(entry.path);
    if (path) map.set(path, { path, data: entry.data });
  }
  return map;
}

function isManagedBackup(input: unknown): input is JsonRecord {
  return isRecord(input) && input.format === MANAGED_BACKUP_FORMAT &&
    (input.schemaVersion === 1 || input.schemaVersion === 2 || input.schemaVersion === 3) && isRecord(input.content);
}

function isOssApplicationBackup(input: unknown): input is JsonRecord {
  return isRecord(input) && (input.schemaVersion === 1 || input.schemaVersion === 2) &&
    isRecord(input.tables) && Array.isArray(input.uploads);
}

function normalizeDeclaredSections(value: unknown, fallback: readonly BackupSectionId[]) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length === 0) throw new Error('This backup has no selectable sections.');
  const sections = [...new Set(value.map(String))];
  if (sections.some((section) => !BACKUP_SECTION_IDS.includes(section as BackupSectionId))) {
    throw new Error('This backup declares an unsupported section.');
  }
  return sections as BackupSectionId[];
}

export function inspectOrbitPageBackup(input: unknown): OrbitPageBackupInspection {
  if (isManagedBackup(input)) {
    if (input.schemaVersion !== 1 && !Array.isArray(input.includedSections)) {
      throw new Error('This selective managed backup is missing its included sections.');
    }
    const sections = input.schemaVersion === 1
      ? [...LEGACY_MANAGED_BACKUP_SECTION_IDS]
      : normalizeDeclaredSections(input.includedSections, []);
    if (sections.some((section) => !MANAGED_BACKUP_SECTION_IDS.includes(section as typeof MANAGED_BACKUP_SECTION_IDS[number]))) {
      throw new Error('This managed backup declares an unsupported section.');
    }
    return { source: 'managed', sections };
  }
  if (isOssApplicationBackup(input)) {
    if (input.schemaVersion === 2 && !Array.isArray(input.includedSections)) {
      throw new Error('This selective backup is missing its included sections.');
    }
    return {
      source: 'self-hosted',
      sections: input.schemaVersion === 1
        ? [...BACKUP_SECTION_IDS]
        : normalizeDeclaredSections(input.includedSections, []),
    };
  }
  throw new Error('This is not a supported OrbitPage backup.');
}

function managedProfileRow(profile: JsonRecord) {
  const socialLinks = isRecord(profile.socialLinks)
    ? profile.socialLinks
    : isRecord(profile.social_links) ? profile.social_links : {};
  const appearance = isRecord(profile.appearance) ? profile.appearance : {};
  return {
    id: 1,
    name: requiredString(profile.name),
    bio: requiredString(profile.bio),
    avatar: requiredString(profile.avatar),
    social_links: JSON.stringify(socialLinks),
    show_avatar: profile.showAvatar === false || profile.show_avatar === 0 ? 0 : 1,
    name_font_size: optionalString(profile.nameFontSize ?? profile.name_font_size),
    bio_font_size: optionalString(profile.bioFontSize ?? profile.bio_font_size),
    tab_title: optionalString(profile.tabTitle ?? profile.tab_title),
    meta_description: optionalString(profile.metaDescription ?? profile.meta_description),
    footer_text: optionalString(profile.footerText ?? profile.footer_text),
    show_orbitpage_badge: profile.showOrbitPageBadge === false || profile.show_orbitpage_badge === 0 ? 0 : 1,
    favicon: optionalString(profile.favicon),
    google_analytics_id: optionalString(profile.googleAnalyticsId ?? profile.google_analytics_id),
    privacy_policy_url: optionalString(profile.privacyPolicyUrl ?? profile.privacy_policy_url),
    cookie_policy_url: optionalString(profile.cookiePolicyUrl ?? profile.cookie_policy_url),
    admin_onboarding_enabled: profile.adminOnboardingEnabled === false || profile.admin_onboarding_enabled === 0 ? 0 : 1,
    appearance: JSON.stringify(appearance),
  };
}

function managedLinkRow(link: JsonRecord, index: number) {
  const content = typeof link.content === 'string'
    ? link.content
    : link.content === undefined || link.content === null ? null : JSON.stringify(link.content);
  return {
    id: String(link.id || `imported-${index + 1}`),
    title: requiredString(link.title),
    description: requiredString(link.description),
    url: requiredString(link.url),
    hide_url: link.hideUrl === true || link.hide_url === 1 ? 1 : 0,
    type: requiredString(link.type) || 'link',
    icon: optionalString(link.icon),
    icon_type: optionalString(link.iconType ?? link.icon_type),
    background_color: optionalString(link.backgroundColor ?? link.background_color),
    text_color: optionalString(link.textColor ?? link.text_color),
    surface_effect: optionalString(link.surfaceEffect ?? link.surface_effect),
    size: optionalString(link.size),
    content,
    text_items: Array.isArray(link.textItems) ? JSON.stringify(link.textItems) : null,
    title_font_family: optionalString(link.titleFontFamily ?? link.title_font_family),
    description_font_family: optionalString(link.descriptionFontFamily ?? link.description_font_family),
    text_alignment: optionalString(link.alignment ?? link.text_alignment),
    title_font_size: optionalString(link.titleFontSize ?? link.title_font_size),
    description_font_size: optionalString(link.descriptionFontSize ?? link.description_font_size),
    sort_order: index,
    is_active: link.isActive === false || link.is_active === 0 ? 0 : 1,
    click_count: optionalNumber(link.clickCount ?? link.click_count) || 0,
    cta_action: optionalString(link.ctaAction ?? link.cta_action),
    cta_click_count: optionalNumber(link.ctaClicks ?? link.cta_click_count) || 0,
    status: optionalString(link.status) || 'live',
    campaign_name: optionalString(link.campaignName ?? link.campaign_name),
    start_date: optionalString(link.startDate ?? link.start_date),
    start_time: optionalString(link.startTime ?? link.start_time),
    end_date: optionalString(link.endDate ?? link.end_date),
    end_time: optionalString(link.endTime ?? link.end_time),
    timezone: optionalString(link.timezone),
    availability: link.availability === 'unavailable' ? 'unavailable' : 'available',
    cover_image: optionalString(link.coverImage ?? link.cover_image),
    cover_image_alt: optionalString(link.coverImageAlt ?? link.cover_image_alt),
  };
}

export function prepareSelfHostedRestoreBackup(
  input: unknown,
  requestedSections?: readonly BackupSectionId[],
) {
  if (isOssApplicationBackup(input)) return input;
  if (!isManagedBackup(input)) throw new Error('This is not a supported OrbitPage backup.');

  const inspection = inspectOrbitPageBackup(input);
  const sections = requestedSections ? [...new Set(requestedSections)] : inspection.sections;
  const unavailable = sections.find((section) => !inspection.sections.includes(section));
  if (unavailable) throw new Error(`Backup does not contain section: ${unavailable}`);
  const content = input.content as JsonRecord;
  const profile = isRecord(content.profile) ? content.profile : {};
  const theme = isRecord(content.theme) ? content.theme : {};
  const consent = isRecord(content.consentConfig) ? content.consentConfig : {};
  const textFiles = Array.isArray(content.textFiles) ? content.textFiles.filter(isRecord) : [];
  const sitemap = isRecord(content.sitemap) ? content.sitemap : null;
  const tables: JsonRecord = {};

  if (sections.includes('profile')) tables.profile_data = [managedProfileRow(profile)];
  if (sections.includes('links')) {
    tables.links = (Array.isArray(content.links) ? content.links.filter(isRecord) : []).map(managedLinkRow);
  }
  if (sections.includes('pages')) tables.subpages_config = [{ id: 1, full_config: JSON.stringify(Array.isArray(content.subpages) ? content.subpages : []) }];
  if (sections.includes('theme')) {
    tables.theme_config = [{
      id: 1,
      primary_color: optionalString(theme.primary) || '#007bff',
      background_color: optionalString(theme.background) || '#ffffff',
      text_color: optionalString(theme.foreground) || '#000000',
      button_style: optionalString(theme.buttonStyle) || 'rounded',
      full_config: JSON.stringify(theme),
    }];
  }
  if (sections.includes('menu')) tables.menu_config = [{ id: 1, full_config: JSON.stringify(isRecord(content.menu) ? content.menu : {}) }];
  if (sections.includes('privacy')) {
    tables.cookie_consent_config = [{
      id: 1,
      mode: optionalString(consent.mode) || 'builder',
      enabled: consent.enabled === false ? 0 : 1,
      full_config: JSON.stringify(consent),
    }];
  }
  if (sections.includes('discovery')) {
    tables.text_files = textFiles.map((file, index) => ({
      file_key: requiredString(file.key) || `custom-${index + 1}`,
      file_path: optionalString(file.path),
      is_custom: file.isCustom === true ? 1 : 0,
      content: requiredString(file.content),
      updated_at: optionalString(file.updatedAt) || new Date(0).toISOString(),
    }));
    tables.sitemap_config = sitemap && typeof sitemap.generatedAt === 'string'
      ? [{ id: 1, generated_at: sitemap.generatedAt, updated_at: sitemap.generatedAt }]
      : [];
  }

  return {
    schemaVersion: 2,
    appVersion: requiredString(input.runtimeVersion) || 'managed',
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
    includedSections: sections,
    tables,
    uploads: [],
  };
}

function selfHostedContent(input: JsonRecord, sections: readonly BackupSectionId[]) {
  const tables = input.tables as JsonRecord;
  const profileRows = Array.isArray(tables.profile_data) ? tables.profile_data.filter(isRecord) : [];
  const linkRows = Array.isArray(tables.links) ? tables.links.filter(isRecord) : [];
  const themeRows = Array.isArray(tables.theme_config) ? tables.theme_config.filter(isRecord) : [];
  const menuRows = Array.isArray(tables.menu_config) ? tables.menu_config.filter(isRecord) : [];
  const consentRows = Array.isArray(tables.cookie_consent_config) ? tables.cookie_consent_config.filter(isRecord) : [];
  const textFileRows = Array.isArray(tables.text_files) ? tables.text_files.filter(isRecord) : [];
  const sitemapRows = Array.isArray(tables.sitemap_config) ? tables.sitemap_config.filter(isRecord) : [];

  return {
    ...(sections.includes('profile') ? { profile: mapProfile(profileRows[0] || {}) } : {}),
    ...(sections.includes('links') ? {
      links: linkRows
        .slice()
        .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
        .map(mapLink),
    } : {}),
    ...(sections.includes('theme') ? { theme: mapTheme(themeRows[0] || {}) } : {}),
    ...(sections.includes('menu') ? { menu: parseJsonRecord(menuRows[0]?.full_config) } : {}),
    ...(sections.includes('privacy') ? { consentConfig: mapConsentConfig(consentRows[0] || {}) } : {}),
    ...(sections.includes('discovery') ? {
      textFiles: mapTextFiles(textFileRows),
      ...(mapSitemap(sitemapRows) ? { sitemap: mapSitemap(sitemapRows) } : {}),
    } : {}),
  };
}

export async function prepareHostedRestoreBackup(
  input: unknown,
  uploadMedia: HostedBackupMediaUploader,
  requestedSections?: readonly BackupSectionId[],
): Promise<HostedBackupImportResult> {
  const managedInput = isManagedBackup(input) ? input : null;
  const selfHostedInput = isOssApplicationBackup(input) ? input : null;
  if (!managedInput && !selfHostedInput) throw new Error('This is not a supported OrbitPage backup.');
  const inspection = inspectOrbitPageBackup(input);
  const source = inspection.source;
  const selectedSections = requestedSections
    ? [...new Set(requestedSections)]
    : inspection.sections;
  const unavailable = selectedSections.find((section) => !inspection.sections.includes(section));
  if (unavailable) throw new Error(`Backup does not contain section: ${unavailable}`);
  const contentSections = selectedSections.filter((section) =>
    MANAGED_BACKUP_SECTION_IDS.includes(section as typeof MANAGED_BACKUP_SECTION_IDS[number]));
  if (contentSections.length === 0) throw new Error('Select at least one page section to restore.');
  const migrateSelectedMedia = source === 'self-hosted' && selectedSections.includes('media');
  const uploads = selfHostedInput ? asUploadMap(selfHostedInput.uploads) : new Map<string, OssUpload>();
  const referencedUploads = new Set<string>();
  const mediaCache = new Map<string, Promise<string>>();
  let migratedMedia = 0;

  const migrateValue = async (value: unknown, path: Array<string | number>): Promise<unknown> => {
    if (typeof value === 'string') {
      if (!migrateSelectedMedia && source === 'self-hosted') return value;
      if (!isMediaPath(path)) return value;
      const embedded = parseDataUrl(value);
      const uploadPath = embedded ? null : normalizeUploadPath(value);
      const upload = uploadPath ? uploads.get(uploadPath) : undefined;
      if (!embedded && !upload) return value;

      const mimeType = embedded?.mimeType || mimeTypeForPath(upload?.path || '');
      if (!mimeType || !ALLOWED_MEDIA_TYPES.has(mimeType)) {
        throw new Error(`The backup contains an unsupported media type at ${path.join('.')}.`);
      }

      if (upload) referencedUploads.add(upload.path);
      const cacheKey = embedded ? value : `upload:${upload?.path}`;
      const existing = mediaCache.get(cacheKey);
      if (existing) return existing;

      const slot = normalizeSlot(path);
      const mediaPromise = uploadMedia({
        base64: embedded?.base64 || upload?.data || '',
        fileName: upload?.path.split('/').pop() || `${slot}.${extensionForMimeType(mimeType)}`,
        mimeType,
        purpose: purposeForPath(path),
        slot,
      }).then((url) => {
        migratedMedia += 1;
        return url;
      });
      mediaCache.set(cacheKey, mediaPromise);
      return mediaPromise;
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map((entry, index) => migrateValue(entry, [...path, index])));
    }

    if (isRecord(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await migrateValue(entry, [...path, key])] as const),
      );
      return Object.fromEntries(entries);
    }

    return value;
  };

  const sourceContent = managedInput ? managedInput.content as JsonRecord : null;
  const rawContent = source === 'managed'
    ? contentSections.reduce<JsonRecord>((result, section) => {
        const key = section === 'privacy' ? 'consentConfig' : section === 'discovery' ? 'textFiles' : section;
        result[key] = sourceContent?.[key];
        if (section === 'discovery' && sourceContent?.sitemap !== undefined) result.sitemap = sourceContent.sitemap;
        return result;
      }, {})
    : selfHostedContent(selfHostedInput as JsonRecord, contentSections);
  const content = await migrateValue(rawContent, ['content']) as JsonRecord;

  const links = Array.isArray(content.links) ? content.links : [];
  for (const [index, link] of links.entries()) {
    if (!isRecord(link) || typeof link.content !== 'string') continue;
    const parsedContent = parseJson(link.content, null);
    if (!parsedContent || (typeof parsedContent !== 'object')) continue;
    link.content = JSON.stringify(await migrateValue(parsedContent, ['content', 'links', index, 'content']));
  }

  const isLegacyComplete = LEGACY_MANAGED_BACKUP_SECTION_IDS.every((section) => contentSections.includes(section)) &&
    !contentSections.includes('discovery');
  const backup = {
    format: MANAGED_BACKUP_FORMAT,
    schemaVersion: isLegacyComplete ? 1 : 2,
    runtimeVersion: managedInput
      ? requiredString(managedInput.runtimeVersion).slice(0, 40) || 'managed'
      : requiredString(selfHostedInput?.appVersion).slice(0, 40) || 'self-hosted',
    createdAt: typeof (managedInput || selfHostedInput)?.createdAt === 'string' &&
      !Number.isNaN(Date.parse((managedInput || selfHostedInput)?.createdAt as string))
      ? (managedInput || selfHostedInput)?.createdAt
      : new Date().toISOString(),
    source: managedInput && isRecord(managedInput.source)
      ? managedInput.source
      : { username: 'self-hosted' },
    ...(!isLegacyComplete ? { includedSections: contentSections } : {}),
    content,
  };

  return {
    backup,
    source,
    migratedMedia,
    skippedUploads: Math.max(0, uploads.size - referencedUploads.size),
  };
}
