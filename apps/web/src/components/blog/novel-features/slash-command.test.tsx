import { describe, expect, it, vi } from 'vitest';

// Mock novel to avoid CSS module import errors from react-tweet
vi.mock('novel', () => ({
  createSuggestionItems: (items: unknown[]) => items,
  createImageUpload: vi.fn(() => vi.fn()),
}));

import { createSuggestionItems } from './slash-command';

describe('suggestionItems', () => {
  const createItems = () => createSuggestionItems(vi.fn());

  it('exports an array of suggestion items', () => {
    const suggestionItems = createItems();
    expect(Array.isArray(suggestionItems)).toBe(true);
    expect(suggestionItems.length).toBeGreaterThan(0);
  });

  it('each item has required fields', () => {
    const suggestionItems = createItems();
    for (const item of suggestionItems) {
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('icon');
      expect(item).toHaveProperty('command');
      expect(typeof item.command).toBe('function');
    }
  });

  it('includes expected block types', () => {
    const suggestionItems = createItems();
    const titles = suggestionItems.map((item: { title: string }) => item.title);
    expect(titles).toContain('Text');
    expect(titles).toContain('Heading 1');
    expect(titles).toContain('Heading 2');
    expect(titles).toContain('Heading 3');
    expect(titles).toContain('Bullet List');
    expect(titles).toContain('Image');
    expect(titles).toContain('Embed Products');
  });

  it('each item has searchTerms array', () => {
    const suggestionItems = createItems();
    for (const item of suggestionItems) {
      const typed = item as { searchTerms?: string[] };
      expect(Array.isArray(typed.searchTerms)).toBe(true);
      expect(typed.searchTerms?.length).toBeGreaterThan(0);
    }
  });

  it('uses the supplied merchant-scoped uploader for slash image commands', () => {
    const uploadImage = vi.fn();
    const suggestionItems = createSuggestionItems(uploadImage);
    const imageCommand = suggestionItems.find(
      (item: { title: string }) => item.title === 'Image'
    ) as { command: (input: unknown) => void };
    const file = new File(['image'], 'inline.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    vi.spyOn(document, 'createElement').mockReturnValue(input);
    vi.spyOn(input, 'click').mockImplementation(() =>
      input.onchange?.(new Event('change'))
    );
    const editor = {
      chain: () => ({
        deleteRange: () => ({ run: vi.fn() }),
        focus: () => ({ deleteRange: () => ({ run: vi.fn() }) }),
      }),
      view: { state: { selection: { from: 42 } } },
    };

    imageCommand.command({ editor, range: { from: 1, to: 2 } });

    expect(uploadImage).toHaveBeenCalledWith(file, editor.view, 42);
  });
});
