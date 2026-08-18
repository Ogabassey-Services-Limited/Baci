import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('product-details-page lazy boundaries', () => {
  it('keeps negotiation modal behind a dynamic client boundary', () => {
    const pageSource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page.tsx',
      'utf8'
    );
    const lazySource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page/product-details-page-lazy-components.ts',
      'utf8'
    );

    expect(pageSource).not.toMatch(/import\s*{\s*NegotiationModal\s*}\s*from/);
    expect(lazySource).toMatch(/import\([^)]*NegotiationModal[^)]*\)/);
  });

  it('keeps post-action modal and cart animation code out of the initial client graph', () => {
    const pageSource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page.tsx',
      'utf8'
    );
    const lazySource = readFileSync(
      'src/components/storefront/ogabassey/pages/product-details-page/product-details-page-lazy-components.ts',
      'utf8'
    );

    expect(pageSource).not.toMatch(/import\s*{\s*FlyToCartAnimation\s*}\s*from/);
    expect(pageSource).not.toMatch(/import\s*{\s*SelectionRequiredModal\s*}\s*from/);
    expect(lazySource).toMatch(/import\([^)]*FlyToCartAnimation[^)]*\)/);
    expect(lazySource).toMatch(/import\([^)]*selection-required-modal[^)]*\)/);
  });
});
