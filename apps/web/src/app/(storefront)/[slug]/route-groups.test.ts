import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const slugDirectory = dirname(fileURLToPath(import.meta.url));

const runtimeRouteManifest = [
  '(home)/page.tsx',
  '(home)/loading.tsx',
  '(catalog)/loading.tsx',
  '(catalog)/products/page.tsx',
  '(catalog)/products/[productSlug]/page.tsx',
  '(catalog)/products/[productSlug]/loading.tsx',
  '(catalog)/product/[productSlug]/page.tsx',
  '(catalog)/[category]/page.tsx',
  '(catalog)/[category]/[productSlug]/page.tsx',
  '(catalog)/[category]/[productSlug]/loading.tsx',
  '(catalog)/[category]/compare/[comparisonSlug]/loading.tsx',
  '(catalog)/[category]/best-under/[priceBandSlug]/loading.tsx',
  '(blog)/loading.tsx',
  '(blog)/blog/page.tsx',
  '(blog)/blog/[postSlug]/page.tsx',
  '(blog)/blog/[postSlug]/loading.tsx',
  '(content)/loading.tsx',
  '(commerce)/loading.tsx',
  '(customer)/loading.tsx',
  '(utility)/loading.tsx',
];

describe('storefront route groups', () => {
  it('exposes the Task 3 runtime route entrypoints and loading boundaries', () => {
    for (const routePath of runtimeRouteManifest) {
      expect(existsSync(resolve(slugDirectory, routePath))).toBe(true);
    }
  });
});
