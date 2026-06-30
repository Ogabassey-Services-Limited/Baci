import { describe, expect, it } from 'vitest';
import { mergeStorefrontSmartAppBannerOther } from './storefront-smart-app-banner-metadata';

describe('mergeStorefrontSmartAppBannerOther', () => {
  it('adds the OgaBassey Smart App Banner metadata for Oga identifiers', () => {
    expect(
      mergeStorefrontSmartAppBannerOther('ogabassey', {
        'product:price:amount': '500000',
      })
    ).toEqual({
      'apple-itunes-app': 'app-id=6472735367',
      'product:price:amount': '500000',
    });
  });

  it('normalizes OgaBassey custom-domain identifiers before matching', () => {
    expect(
      mergeStorefrontSmartAppBannerOther('https://www.ogabassey.com/')
    ).toEqual({
      'apple-itunes-app': 'app-id=6472735367',
    });
  });

  it('leaves generic storefront metadata unchanged', () => {
    expect(
      mergeStorefrontSmartAppBannerOther('generic-store', {
        'product:price:amount': '500000',
      })
    ).toEqual({
      'product:price:amount': '500000',
    });
    expect(mergeStorefrontSmartAppBannerOther('generic-store')).toBeUndefined();
  });
});
