import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicTextCard } from './PublicTextCard';

describe('PublicTextCard', () => {
  it('ignores the whole-card URL for list cards', () => {
    const html = renderToStaticMarkup(
      <PublicTextCard
        link={{
          id: 'list-1',
          title: 'Useful links',
          description: '',
          url: 'https://whole-card.example',
          type: 'text',
          textItems: [{ text: 'First item', url: 'https://item.example' }],
        }}
      />,
    );

    expect(html).not.toContain('whole-card.example');
    expect(html).toContain('href="https://item.example"');
  });
});
