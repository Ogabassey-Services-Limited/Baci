import { describe, expect, it } from 'vitest';
import { tokenizeContentText } from './tokenize-content-text';

describe('tokenizeContentText', () => {
  it('normalizes currency, apostrophes, and plus signs before splitting', () => {
    expect(tokenizeContentText("Samsung's Galaxy S24+ £50")).toEqual([
      'samsung',
      'galaxy',
      's24',
      'plus',
      'gbp',
      '50',
    ]);
  });
});
