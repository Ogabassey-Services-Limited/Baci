import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isStorefrontRequest,
  NON_STOREFRONT_TOP_LEVEL_SEGMENTS,
} from './root-dynamic-body';

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

  it('returns false when first pathname segment starts with underscore', () => {
    const headers = createHeaders({ 'x-pathname': '/_internal' });
    expect(isStorefrontRequest(headers)).toBe(false);
  });

  it('returns false when first pathname segment contains a dot', () => {
    const headers = createHeaders({ 'x-pathname': '/foo.bar' });
    expect(isStorefrontRequest(headers)).toBe(false);
  });

  it('supports query stripping before segment parsing', () => {
    const headers = createHeaders({ 'x-pathname': '/shop?ref=1' });
    expect(isStorefrontRequest(headers)).toBe(true);
  });

  it('returns false for root pathname with no segment', () => {
    const headers = createHeaders({ 'x-pathname': '/' });
    expect(isStorefrontRequest(headers)).toBe(false);
  });
});

describe('NON_STOREFRONT_TOP_LEVEL_SEGMENTS coverage', () => {
  it('includes every non-grouped top-level app directory', () => {
    const appDir = dirname(fileURLToPath(import.meta.url));

    const topLevelSegments = readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('(') && !name.startsWith('['))
      .map((name) => name.toLowerCase());

    const missing = topLevelSegments
      .filter((segment) => !NON_STOREFRONT_TOP_LEVEL_SEGMENTS.has(segment))
      .sort();

    expect(
      missing,
      missing.length > 0
        ? `Add missing entries to NON_STOREFRONT_TOP_LEVEL_SEGMENTS: ${missing.join(
            ', '
          )}`
        : undefined
    ).toEqual([]);
  });
});
