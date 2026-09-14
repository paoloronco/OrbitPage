const plainText = (value, maximum = 2_000) => {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
};

const field = (record, ...keys) => {
  for (const key of keys) {
    const value = plainText(record?.[key]);
    if (value) return value;
  }
  return '';
};

const markdownText = (value, maximum) => plainText(value, maximum).replace(/([\\`*_{}\[\]<>])/g, '\\$1');

const publicHref = (value, baseUrl) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), baseUrl);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const blockMarkdown = (block, canonicalUrl) => {
  if (block?.isActive === false || block?.is_active === false) return '';
  const title = markdownText(block?.title, 200);
  const description = markdownText(block?.description, 1_000);
  const href = publicHref(block?.url, canonicalUrl);
  const content = typeof block?.content === 'string' && !/^[{[]/.test(block.content.trim())
    ? markdownText(block.content, 4_000)
    : '';
  const items = Array.isArray(block?.textItems ?? block?.text_items) ? (block.textItems ?? block.text_items) : [];
  const itemLines = items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const label = markdownText(item.text, 500);
    if (!label) return [];
    const itemHref = publicHref(item.url, canonicalUrl);
    return [itemHref ? `- [${label}](${itemHref})` : `- ${label}`];
  });
  if (!title && !description && !content && !href && itemLines.length === 0) return '';
  return [
    title ? `### ${title}` : '### Content',
    description,
    content,
    href ? `[Open destination](${href})` : '',
    ...itemLines,
  ].filter(Boolean).join('\n\n');
};

export const acceptsMarkdown = (accept = '') => String(accept).split(',').some((entry) => {
  const [mediaType, ...parameters] = entry.trim().toLowerCase().split(';');
  if (mediaType !== 'text/markdown') return false;
  const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
  return !quality || Number(quality.trim().slice(2)) > 0;
});

export const machineReadableEnabled = (profile) => (
  profile?.machine_readable_enabled === 1 || profile?.machineReadableEnabled === true
);

export const renderPublicPageMarkdown = ({ profile, links, canonicalUrl, menu, document = 'page' }) => {
  const menuDocument = document === 'menu';
  const title = markdownText(
    menuDocument ? field(menu, 'name') : field(profile, 'tab_title', 'tabTitle', 'name'),
    200,
  ) || (menuDocument ? 'Menu' : 'OrbitPage');
  const description = markdownText(
    menuDocument ? field(menu, 'description') : field(profile, 'meta_description', 'metaDescription', 'bio'),
    2_000,
  );
  const sections = [`# ${title}`, description ? `> ${description}` : '', `Canonical: ${canonicalUrl}`];

  if (menuDocument) {
    const menuSections = Array.isArray(menu?.sections) ? menu.sections : [];
    const items = Array.isArray(menu?.items) ? menu.items : [];
    for (const section of menuSections) {
      if (!section || section.visible === false) continue;
      const sectionId = field(section, 'id');
      const sectionName = markdownText(field(section, 'name'), 200);
      const rows = items.flatMap((item) => {
        if (!item || item.available === false || field(item, 'sectionId') !== sectionId) return [];
        const name = markdownText(field(item, 'name'), 200);
        const itemDescription = markdownText(field(item, 'description'), 1_000);
        return name ? [`- **${name}**${itemDescription ? ` — ${itemDescription}` : ''}`] : [];
      });
      if (sectionName && rows.length) sections.push(`## ${sectionName}\n\n${rows.join('\n')}`);
    }
  } else {
    const blocks = (links || []).map((block) => blockMarkdown(block, canonicalUrl)).filter(Boolean);
    if (blocks.length) sections.push(`## Public content\n\n${blocks.join('\n\n')}`);
    const socialLinks = profile?.social_links ?? profile?.socialLinks;
    if (socialLinks && typeof socialLinks === 'object' && !Array.isArray(socialLinks)) {
      const rows = Object.entries(socialLinks).flatMap(([name, value]) => {
        const href = publicHref(value, canonicalUrl);
        return href ? [`- [${markdownText(name, 80)}](${href})`] : [];
      });
      if (rows.length) sections.push(`## Profiles\n\n${rows.join('\n')}`);
    }
  }

  return `${sections.filter(Boolean).join('\n\n')}\n`;
};
