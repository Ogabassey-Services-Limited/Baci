import { describe, expect, it } from 'vitest';
import { isStorefrontRequest } from './root-dynamic-body';

function createHeaders(entries: Record<string, string | undefined>): {
  get(name: string): string | null;
} {
  return {
    get(name: string) {
      const value = entries[name];
      return value ?? null;
    },
  };
}

describe('isStorefrontRequest', () => {
  it('returns true for subdomain storefront requests', () => {
    const headers = createHeaders({ 'x-merchant-slug': 'ogabassey' });
    expect(isStorefrontRequest(headers)).toBe(true);
  });

  it('returns true for custom-domain storefront requests', () => {
    const headers = createHeaders({ 'x-custom-domain': 'ogabassey.com' });
    expect(isStorefrontRequest(headers)).toBe(true);
  });

  it('returns true for path-based storefront routes', () => {
    const headers = createHeaders({ 'x-pathname': '/ogabassey' });
    expect(isStorefrontRequest(headers)).toBe(true);
  });

  it('returns false for dashboard routes', () => {
    const headers = createHeaders({ 'x-pathname': '/dashboard' });
    expect(isStorefrontRequest(headers)).toBe(false);
  });

  it('returns false for API routes', () => {
    const headers = createHeaders({
      'x-pathname': '/api/merchant/blog/upload',
    });
    expect(isStorefrontRequest(headers)).toBe(false);
  });

  it('returns false when no storefront signals exist', () => {
    const headers = createHeaders({});
    expect(isStorefrontRequest(headers)).toBe(false);
  });
});
