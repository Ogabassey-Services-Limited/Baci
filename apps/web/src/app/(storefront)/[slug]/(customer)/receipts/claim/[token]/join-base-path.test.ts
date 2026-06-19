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

  it('normalizes empty and root base paths', () => {
    expect(joinBasePath('/', '/receipts')).toBe('/receipts');
    expect(joinBasePath('', '/receipts')).toBe('/receipts');
    expect(joinBasePath('/ogabassey/', '/')).toBe('/ogabassey/');
    expect(joinBasePath('/ogabassey', '')).toBe('/ogabassey/');
  });
});
