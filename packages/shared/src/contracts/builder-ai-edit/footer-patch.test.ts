import { describe, expect, it } from 'vitest';
import { footerPatchSchema } from './footer-patch';

describe('footerPatchSchema', () => {
  it('rejects duplicate quick-link labels before they can become React keys', () => {
    expect(
      footerPatchSchema.safeParse({
        componentType: 'Footer',
        quickLinks: [
          { label: 'Contact', url: '/contact' },
          { label: 'Contact', url: '/support' },
        ],
      }).success
    ).toBe(false);
  });

  it('accepts distinct bounded quick links', () => {
    expect(
      footerPatchSchema.safeParse({
        componentType: 'Footer',
        quickLinks: [
          { label: 'Contact', url: '/contact' },
          { label: 'Support', url: '/support' },
        ],
      }).success
    ).toBe(true);
  });
});
