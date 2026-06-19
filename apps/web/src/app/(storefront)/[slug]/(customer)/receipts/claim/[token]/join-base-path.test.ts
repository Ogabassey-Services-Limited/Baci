import { describe, expect, it } from 'vitest';
import { joinBasePath } from './join-base-path';

describe('joinBasePath', () => {
  it('joins optional storefront base paths', () => {
    expect(joinBasePath('/ogabassey', '/receipts')).toBe('/ogabassey/receipts');
    expect(joinBasePath('/ogabassey/', '/receipts')).toBe(
      '/ogabassey/receipts'
    );
    expect(joinBasePath('/ogabassey', 'receipts')).toBe('/ogabassey/receipts');
    expect(joinBasePath(undefined, '/receipts')).toBe('/receipts');
  });
});
