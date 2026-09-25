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
    expect(source).toContain('visualMode && !focusedLink ? null');
    expect(source).toContain('editRequest={String(link.id) === String(visualFocusLinkId) ? visualEditRequest : undefined}');
    expect(source.match(/editing=\{visualMode \? true : editingLinkId === String\(link.id\)\}/g)).toHaveLength(2);
    expect(source).toContain('onVisualFocusChange?.(null)');
  });
});
