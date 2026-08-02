import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pdpRoot = dirname(fileURLToPath(import.meta.url));
const categoryPdpOgPath = join(
  pdpRoot,
  '[category]',
  '[productSlug]',
  'opengraph-image.tsx'
);
const flatPdpOgPath = join(
  pdpRoot,
  'products',
  '[productSlug]',
  'opengraph-image.tsx'
);
const categoryPdpPagePath = join(
  pdpRoot,
  '[category]',
  '[productSlug]',
  'page.tsx'
);
const flatPdpPagePath = join(pdpRoot, 'products', '[productSlug]', 'page.tsx');

describe('product social-image architecture', () => {
  it('does not define request-time product social-image functions', () => {
    expect(existsSync(categoryPdpOgPath)).toBe(false);
    expect(existsSync(flatPdpOgPath)).toBe(false);
  });

  it('overrides inherited store images with product metadata', () => {
    for (const pagePath of [categoryPdpPagePath, flatPdpPagePath]) {
      const source = readFileSync(pagePath, 'utf8');

      expect(source).toContain('openGraph: {');
      expect(source).toContain('images: socialMetadata.openGraphImages');
      expect(source).toContain('twitter: {');
      expect(source).toContain('images: socialMetadata.twitterImages');
    }
  });
});
