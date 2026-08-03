import { existsSync } from 'node:fs';
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
describe('product social-image architecture', () => {
  it('does not define request-time product social-image functions', () => {
    expect(existsSync(categoryPdpOgPath)).toBe(false);
    expect(existsSync(flatPdpOgPath)).toBe(false);
  });
});
