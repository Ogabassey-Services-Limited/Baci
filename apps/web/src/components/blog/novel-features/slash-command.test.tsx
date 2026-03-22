import { describe, expect, it, vi } from 'vitest';

// Mock novel to avoid CSS module import errors from react-tweet
vi.mock('novel', () => ({
  createSuggestionItems: (items: unknown[]) => items,
  createImageUpload: vi.fn(() => vi.fn()),
  Command: { configure: vi.fn() },
  renderItems: vi.fn(),
}));

import { suggestionItems } from './slash-command';

function expectValidSuggestionItem(item: unknown) {
  expect(item).toHaveProperty('title');
  expect(item).toHaveProperty('description');
  expect(item).toHaveProperty('icon');
  expect(item).toHaveProperty('command');
  expect(typeof (item as { command?: unknown }).command).toBe('function');
  expect(Array.isArray((item as { searchTerms?: unknown[] }).searchTerms)).toBe(
    true
  );
}

describe('suggestionItems', () => {
  it('exports an array of suggestion items', () => {
    expect(Array.isArray(suggestionItems)).toBe(true);
    expect(suggestionItems.length).toBeGreaterThan(0);
  });

  it('each item has required fields', () => {
    for (const item of suggestionItems) {
      expectValidSuggestionItem(item);
    }
  });

  it('includes expected block types', () => {
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
    for (const item of suggestionItems) {
      const typed = item as { searchTerms?: string[] };
      expect(Array.isArray(typed.searchTerms)).toBe(true);
      expect(typed.searchTerms?.length).toBeGreaterThan(0);
    }
  });

  it('fails validation when a malformed suggestion item is introduced', () => {
    const invalidItems = [
      ...suggestionItems,
      {
        title: 'Broken item',
        description: 'Missing a callable command.',
        icon: null,
        command: 'not-a-function',
        searchTerms: ['broken'],
      },
    ];

    expect(() => {
      for (const item of invalidItems) {
        expectValidSuggestionItem(item);
      }
    }).toThrow();
  });
});
