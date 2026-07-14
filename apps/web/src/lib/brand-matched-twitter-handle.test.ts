import { describe, expect, it } from 'vitest';
import { getBrandMatchedTwitterHandle } from './brand-matched-twitter-handle';

describe('getBrandMatchedTwitterHandle', () => {
  it('normalizes a handle whose identity matches the merchant brand', () => {
    expect(getBrandMatchedTwitterHandle('Ogabassey', 'ogabassey')).toBe(
      '@ogabassey'
    );
  });

  it('omits an unrelated handle instead of asserting false entity identity', () => {
    expect(
      getBrandMatchedTwitterHandle('Ogabassey', '@sxgtow')
    ).toBeUndefined();
  });

  it('normalizes a matching Twitter profile URL', () => {
    expect(
      getBrandMatchedTwitterHandle(
        'Test Store',
        'https://twitter.com/teststore'
      )
    ).toBe('@teststore');
  });

  it('normalizes a matching X profile URL', () => {
    expect(
      getBrandMatchedTwitterHandle('Test Store', 'https://www.x.com/teststore')
    ).toBe('@teststore');
  });

  it('rejects malformed handle values', () => {
    expect(
      getBrandMatchedTwitterHandle('Test Store', 'not a handle')
    ).toBeUndefined();
  });
});
