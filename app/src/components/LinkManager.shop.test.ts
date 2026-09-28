import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./LinkManager.tsx', import.meta.url), 'utf8');
const cardSources = [
  readFileSync(new URL('./LinkCard.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('./TextCard.tsx', import.meta.url), 'utf8'),
];

describe('Shop link shortcut', () => {
  it('adds one native relative Shop destination from the main content editor', () => {
    expect(source).toContain("destination.kind === 'shop'");
    expect(source).toContain("url: shop.path");
    expect(source).toContain("type: 'link'");
    expect(source).toContain('atBlockLimit || hasShopLink');
    expect(source).toContain('tr("Add Shop", "Aggiungi Shop")');
  });

  it('keeps visual content actions in the shared inspector heading', () => {
    expect(source).toContain('[data-orbitpage-content-header-slot]');
    expect(source).toContain('visualMode && visualHeaderSlot ? createPortal(');
    expect(source).toContain('!visualMode && <div className="admin-link-toolbar"');
    expect(source).toContain('tr("Edit the selected card.", "Modifica la card selezionata.")');
    expect(source).not.toContain('Edit this block, then save the content changes.');
  });

  it('moves desktop content creation into the empty inspector with direct shortcuts', () => {
    expect(source).toContain('className="admin-content-start__primary"');
    expect(source).toContain('className="admin-content-quick-add"');
    expect(source).toContain('itemIds: ["link", "internal-links", "heading", "text"]');
    expect(source).toContain('itemIds: ["instagram", "whatsapp", "facebook"]');
    expect(source).toContain('itemIds: ["calendly", "typeform", "github"]');
  });

  it('keeps the category rail synchronized with block-library scrolling', () => {
    expect(source).toContain('onScrollCapture={handleBlockLibraryScroll}');
    expect(source).toContain('data-block-library-category={category.id}');
    expect(source).toContain('data-block-library-filter={category.id}');
    expect(source).toContain('scrollIntoView({ block: "nearest", inline: "nearest" })');
  });

  it('uses the content block label for the card list', () => {
    expect(source).toContain('tr("Content block", "Blocco contenuto")');
  });

  it('does not allow content cards to be dragged on any viewport', () => {
    expect(source).not.toContain('draggable=');
    expect(source).not.toContain('handleDragStart');
    cardSources.forEach((cardSource) => expect(cardSource).not.toContain('admin-card-drag-handle'));
  });

  it('uses one heading per content editor section', () => {
    cardSources.forEach((cardSource) => expect(cardSource).not.toContain('font-bold uppercase tracking-[0.14em]'));
  });

  it('shows the shared floating actions while editing and keeps save disabled until content changed', () => {
    expect(source).toContain('!isViewOnly && (editingLinkId || hasUnsavedChanges || savedNotice) ? createPortal(');
    expect(source).toContain('(editingLinkId || hasUnsavedChanges) && (');
    expect(source).toContain('disabled={!hasUnsavedChanges || preparingLinks.size > 0 || busy}');
    expect(source).not.toContain('!isViewOnly && !isMobile');
  });

  it('uses the full editor width and lets the user cancel editing', () => {
    expect(source).toContain("editingLinkId ? ' is-editing' : ''");
    expect(source).toContain('onClick={revertUnsavedChanges}');
    expect(source).not.toContain('cancelEditingLink');
    expect(source).toContain('tr("Cancel", "Annulla")');
  });

  it('offers a ten-second saved notice that can restore the previous content', () => {
    expect(source).toContain('const CONTENT_SAVE_NOTICE_DURATION_MS = 10_000;');
    expect(source).toContain('showSavedNotice(previousLinks);');
    expect(source).toContain('onClick={handleRevertSavedContent}');
    expect(source).toContain('It will be visible on the public page in about 10 seconds.');
  });

  it('opens only the preview-selected card in the visual editor', () => {
    expect(source).toContain('const focusedLink = visualFocusLinkId');
    expect(source).toContain('visualMode && !focusedLink ? (');
    expect(source).toContain('editRequest={String(link.id) === String(visualFocusLinkId) ? visualEditRequest : undefined}');
    expect(source.match(/editing=\{visualMode \? true : editingLinkId === String\(link.id\)\}/g)).toHaveLength(2);
    expect(source).toContain('onVisualFocusChange?.(null)');
  });

  it('opens newly added blocks immediately so empty media can be configured', () => {
    expect(source.match(/setEditingLinkId\(String\(block\.id\)\)/g)).toHaveLength(2);
    expect(source.match(/if \(visualMode\) onVisualFocusChange\?\.\(String\(block\.id\)\)/g)).toHaveLength(2);
  });

  it('keeps the selected block open after saving', () => {
    expect(source).not.toContain('showSavedNotice(previousLinks);\n        if (visualMode) onVisualFocusChange?.(null);');
    for (const component of ['LinkCard.tsx', 'TextCard.tsx']) {
      const cardSource = readFileSync(new URL(`./${component}`, import.meta.url), 'utf8');
      expect(cardSource).toContain('if (editing === undefined) setIsEditing(false);');
      expect(cardSource).toContain('useLayoutEffect(() => {');
    }
  });
});
