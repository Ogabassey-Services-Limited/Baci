import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OG_IMAGE_FILES = [
  '(blog)/blog/[postSlug]/opengraph-image-markup.tsx',
  'opengraph-image.tsx',
];

describe('storefront OpenGraph Satori styles', () => {
  it('does not use unsupported zIndex styles in ImageResponse markup', () => {
    const routeRoot = dirname(fileURLToPath(import.meta.url));

    for (const relativePath of OG_IMAGE_FILES) {
      let source: string;
      try {
        source = readFileSync(join(routeRoot, relativePath), 'utf8');
      } catch (error) {
        throw new Error(
          `Failed to inspect OpenGraph image source "${relativePath}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      expect(source, relativePath).not.toMatch(/\bzIndex\s*:/);
    }
  });
});
