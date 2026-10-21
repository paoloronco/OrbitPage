import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LinkCard } from './LinkCard';
import type { LinkEditMode } from '@/lib/permissions';

describe('separator editing permissions', () => {
  it.each(['full', 'style', 'images'] as LinkEditMode[])('keeps %s controls within the fields the role can save', editMode => {
    const html = renderToStaticMarkup(<LinkCard
      link={{ id: 'separator', type: 'separator', title: 'Section', description: '', url: '' }}
      editing
      editMode={editMode}
      onUpdate={() => {}}
      onDelete={() => {}}
    />);
    expect(html.includes('aria-label="Text alignment"')).toBe(editMode !== 'images');
    expect(html.includes('aria-label="Line position"')).toBe(editMode === 'full');
    expect(html.includes('Separator background')).toBe(editMode === 'full');
  });
});
