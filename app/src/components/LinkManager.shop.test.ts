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
    expect(source).toContain('(!visualMode || saveError)');
    expect(source).toContain('!visualMode && <>');
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

  it('shows the shared floating save action only when content changed', () => {
    expect(source).toContain('!isViewOnly && (hasUnsavedChanges || savedNotice) ? createPortal(');
    expect(source).toContain('hasUnsavedChanges && (');
    expect(source).not.toContain('!isViewOnly && !isMobile');
  });

  it('uses the full editor width and replaces the toolbar save and cancel with revert', () => {
    expect(source).toContain("editingLinkId ? ' is-editing' : ''");
    expect(source).toContain('onClick={revertUnsavedChanges}');
    expect(source).not.toContain('cancelEditingLink');
    expect(source).not.toContain('tr("Cancel", "Annulla")');
  });

  it('offers a ten-second saved notice that can restore the previous content', () => {
    expect(source).toContain('const CONTENT_SAVE_NOTICE_DURATION_MS = 10_000;');
    expect(source).toContain('showSavedNotice(previousLinks);');
    expect(source).toContain('onClick={handleRevertSavedContent}');
    expect(source).toContain('It will be visible on the public page in about 10 seconds.');
  });

  it('uses the regular content editor when a preview card is selected on mobile', () => {
    expect(source).toContain('const focusedLink = visualFocusLinkId && !isMobile');
    expect(source).toContain('editRequest={String(link.id) === String(visualFocusLinkId) ? visualEditRequest : undefined}');
  });
});
