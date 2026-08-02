import { describe, expect, it } from 'vitest';
import { toCuratedStorefrontInput } from './to-curated-storefront-input';

describe('toCuratedStorefrontInput', () => {
  it('preserves only a safe loaded logo and ignores hero IDs', () => {
    const result = toCuratedStorefrontInput({
      businessName: ' Store ',
      businessType: ' fashion ',
      brandColors: {
        primary: '#111111',
        background: '#ffffff',
        accent: '#f97316',
      },
      merchant: {
        logo_url: 'https://cdn.example.com/logo.png',
        hero_image_ids: ['one'],
      },
    });
    expect(result).toMatchObject({
      businessName: 'Store',
      businessType: 'fashion',
      logoUrl: 'https://cdn.example.com/logo.png',
    });
    expect(result).not.toHaveProperty('hero_image_ids');
  });
  it('normalizes missing and invalid merchant values', () => {
    expect(
      toCuratedStorefrontInput({
        businessName: '',
        businessType: '',
        brandColors: {
          primary: '#111111',
          background: '#ffffff',
          accent: '#f97316',
        },
        merchant: { logo_url: 'javascript:alert(1)' },
      })
    ).toMatchObject({ businessName: 'Your Store' });
  });
});
