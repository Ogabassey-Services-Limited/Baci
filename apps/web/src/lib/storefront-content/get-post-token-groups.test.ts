import { describe, expect, it } from 'vitest';
import { getPostTokenGroups } from './get-post-token-groups';

describe('getPostTokenGroups', () => {
  it('preserves post field order while using canonical tokenization', () => {
    const groups = getPostTokenGroups({
      title: 'Apple Watch 9+',
      excerpt: null,
      category: 'Smartwatches',
      tags: ['buyer guide'],
      keywords: ['£50'],
    });

    expect(groups).toEqual([
      ['apple', 'watch', '9', 'plus'],
      [],
      ['smartwatches'],
      ['buyer', 'guide'],
      ['gbp', '50'],
    ]);
  });

  it('normalizes slash-separated post phrases into comparison boundaries', () => {
    const [titleTokens] = getPostTokenGroups({
      title: 'Apple iPhone 15 / Samsung Galaxy S25',
      excerpt: null,
      category: null,
      tags: null,
      keywords: null,
    });

    expect(titleTokens).toEqual([
      'apple',
      'iphone',
      '15',
      'versus',
      'samsung',
      'galaxy',
      's25',
    ]);
  });
});
