import { describe, expect, it } from 'vitest';
import {
  footerPatchSchema,
  headerPatchSchema,
  safeStorefrontUrlSchema,
} from './navigation';

describe('builder AI edit navigation patches', () => {
  it('permits only safe storefront URL schemes', () => {
    expect(safeStorefrontUrlSchema.safeParse('/collections/new').success).toBe(
      true
    );
    expect(safeStorefrontUrlSchema.safeParse('#newsletter').success).toBe(true);
    expect(
      safeStorefrontUrlSchema.safeParse('https://example.test/shop').success
    ).toBe(true);
    expect(safeStorefrontUrlSchema.safeParse('//example.test').success).toBe(
      false
    );
    expect(safeStorefrontUrlSchema.safeParse('https://').success).toBe(false);
    expect(safeStorefrontUrlSchema.safeParse('#').success).toBe(false);
    for (const unsafeUrl of [
      'javascript:alert(1)',
      'data:text/html,unsafe',
      'file:///tmp/private',
      'mailto:merchant@example.test',
      'tel:+2348000000000',
    ]) {
      expect(safeStorefrontUrlSchema.safeParse(unsafeUrl).success).toBe(false);
    }
  });

  it('rejects unbounded or unknown header patch properties', () => {
    expect(
      headerPatchSchema.safeParse({
        componentType: 'Header',
        navigationLinks: Array.from({ length: 9 }, () => ({
          label: 'Shop',
          url: '/shop',
        })),
      }).success
    ).toBe(false);
    expect(
      headerPatchSchema.safeParse({
        componentType: 'Header',
        logoUrl: 'https://example.test/logo.jpg',
      }).success
    ).toBe(false);
  });

  it('rejects credential-bearing HTTPS URLs everywhere navigation links are accepted', () => {
    const credentialUrl = 'https://merchant:secret@example.test/private';

    expect(safeStorefrontUrlSchema.safeParse(credentialUrl).success).toBe(
      false
    );
    expect(
      headerPatchSchema.safeParse({
        componentType: 'Header',
        ctaButton: { show: true, text: 'Shop', url: credentialUrl },
      }).success
    ).toBe(false);
    expect(
      headerPatchSchema.safeParse({
        componentType: 'Header',
        navigationLinks: [{ label: 'Shop', url: credentialUrl }],
      }).success
    ).toBe(false);
    expect(
      footerPatchSchema.safeParse({
        componentType: 'Footer',
        quickLinks: [{ label: 'Contact', url: credentialUrl }],
      }).success
    ).toBe(false);
  });

  it.each([
    ['layout', ['logo-left-nav-center', 'logo-left-nav-right', 'logo-center']],
    ['paddingY', ['sm', 'md', 'lg']],
    ['searchRadius', ['none', 'sm', 'md', 'full']],
    ['searchStyle', ['outline', 'filled', 'minimal']],
  ] as const)('accepts every real Puck Header %s option', (property, values) => {
    for (const value of values) {
      expect(
        headerPatchSchema.safeParse({
          componentType: 'Header',
          [property]: value,
        }).success
      ).toBe(true);
    }
  });
});
