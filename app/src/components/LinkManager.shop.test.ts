import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./LinkManager.tsx', import.meta.url), 'utf8');

describe('Shop link shortcut', () => {
  it('adds one native relative Shop destination from the main content editor', () => {
    expect(source).toContain("destination.kind === 'shop'");
    expect(source).toContain("url: shop.path");
    expect(source).toContain("type: 'link'");
    expect(source).toContain('atBlockLimit || hasShopLink');
    expect(source).toContain('tr("Add Shop", "Aggiungi Shop")');
  });

  it('does not repeat the selected card heading in the visual editor', () => {
    expect(source).toContain('(!visualMode || !focusedLink || saveError)');
    expect(source).toContain('tr("Edit the selected card.", "Modifica la card selezionata.")');
    expect(source).not.toContain('Edit this block, then save the content changes.');
  });

  it('uses the content block label for the card list', () => {
    expect(source).toContain('tr("Content block", "Blocco contenuto")');
  });

  it('disables card dragging on mobile', () => {
    expect(source).toContain("const canDrag = isFullEdit && !isMobile;");
    expect(source).toContain('draggable={canDrag}');
    expect(source).not.toContain('onTouchStart=');
  });

  it('shows the mobile save action only when content changed', () => {
    expect(source).toContain('!isViewOnly && !isMobile');
    expect(source).toContain('isMobile && !isViewOnly && (hasUnsavedChanges || editingLinkId) ? createPortal(');
    expect(source).toContain('admin-profile-save-float${editingLinkId ? "" : " admin-profile-save-float--single"}');
  });

  it('uses the full editor width and keeps cancel beside save while a card is open', () => {
    expect(source).toContain("editingLinkId ? ' is-editing' : ''");
    expect(source).toContain('onClick={cancelEditingLink}');
    expect(source).toContain('tr("Cancel", "Annulla")');
  });

  it('uses the regular content editor when a preview card is selected on mobile', () => {
    expect(source).toContain('const focusedLink = visualFocusLinkId && !isMobile');
    expect(source).toContain('editRequest={String(link.id) === String(visualFocusLinkId) ? visualEditRequest : undefined}');
  });
});
