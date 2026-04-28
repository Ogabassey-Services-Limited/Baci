import { describe, expect, it } from 'vitest';
import {
  buildAgentPolicyUrls,
  buildAgentProductUrl,
  trimTrailingSlash,
} from '@/lib/storefront-agent-urls';

describe('storefront agent URLs', () => {
  describe('trimTrailingSlash', () => {
    it('leaves URLs without trailing slashes unchanged', () => {
      expect(trimTrailingSlash('https://ogabassey.com')).toBe(
        'https://ogabassey.com'
      );
    });

    it('removes one trailing slash', () => {
      expect(trimTrailingSlash('https://ogabassey.com/')).toBe(
        'https://ogabassey.com'
      );
    });

    it('removes multiple trailing slashes', () => {
      expect(trimTrailingSlash('https://ogabassey.com///')).toBe(
        'https://ogabassey.com'
      );
    });

    it('handles empty and slash-only inputs', () => {
      expect(trimTrailingSlash('')).toBe('');
      expect(trimTrailingSlash('/')).toBe('');
      expect(trimTrailingSlash('///')).toBe('');
    });

    it('throws for nullish inputs outside the typed contract', () => {
      expect(() => trimTrailingSlash(null as unknown as string)).toThrowError(
        TypeError
      );
      expect(() =>
        trimTrailingSlash(undefined as unknown as string)
      ).toThrowError(TypeError);
    });
  });

  describe('buildAgentProductUrl', () => {
    it('builds custom-domain product URLs without merchant slug prefix', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: {
            id: 'product-1',
            slug: 'hp-probook-440-g8',
            name: 'HP ProBook 440 G8',
            category: 'Laptops',
            category_slug: 'laptops',
            canonical_url: null,
          },
        })
      ).toBe('https://ogabassey.com/laptops/hp-probook-440-g8');
    });

    it('encodes category and product slug path segments', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com/',
          product: {
            id: 'product-2',
            slug: 'watch pro + gps',
            name: 'Watch Pro GPS',
            category_slug: 'smart watches',
          },
        })
      ).toBe('https://ogabassey.com/smart%20watches/watch%20pro%20%2B%20gps');
    });

    it('falls back to a generated product route when slug and category are missing', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: {
            id: 'product-3',
            slug: '',
            name: 'USB-C Dock Stand',
            category: null,
          },
        })
      ).toBe('https://ogabassey.com/products/usb-c-dock-stand');
    });

    it('uses canonical paths and an empty base URL', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: '',
          product: {
            id: 'product-4',
            slug: 'fallback',
            name: 'Fallback',
            canonical_url: '/smart watches/watch%20pro',
          },
        })
      ).toBe('/smart%20watches/watch%20pro');
    });

    it('falls back when canonical_url is an empty string', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: {
            id: 'product-empty-canonical',
            slug: 'test-product',
            name: 'Test Product',
            category_slug: 'test-category',
            canonical_url: '',
          },
        })
      ).toBe('https://ogabassey.com/test-category/test-product');
    });

    it('uses nested categories when building product URLs', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: {
            id: 'product-5',
            slug: 'galaxy-s24',
            name: 'Galaxy S24',
            categories: { name: 'Smartphones', slug: 'smartphones' },
          },
        })
      ).toBe('https://ogabassey.com/smartphones/galaxy-s24');
    });

    it('falls back when nested categories are null', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: {
            id: 'product-6',
            slug: 'wireless-charger',
            name: 'Wireless Charger',
            categories: null,
          },
        })
      ).toBe('https://ogabassey.com/products/wireless-charger');
    });

    it('returns predictable product URLs for base URLs without a protocol', () => {
      expect(
        buildAgentProductUrl({
          baseUrl: 'ogabassey.com',
          product: {
            id: 'product-7',
            slug: 'hp-probook',
            name: 'HP ProBook',
            category_slug: 'laptops',
          },
        })
      ).toBe('ogabassey.com/laptops/hp-probook');
    });

    it('throws when the product input is missing', () => {
      expect(() =>
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: null as unknown as Parameters<
            typeof buildAgentProductUrl
          >[0]['product'],
        })
      ).toThrow('Agent product URL requires a product.');
    });

    it('throws when required product fields are missing', () => {
      expect(() =>
        buildAgentProductUrl({
          baseUrl: 'https://ogabassey.com',
          product: {
            id: 'product-8',
          } as unknown as Parameters<typeof buildAgentProductUrl>[0]['product'],
        })
      ).toThrow('Agent product URL requires product id and name.');
    });
  });

  describe('buildAgentPolicyUrls', () => {
    it('normalizes policy URLs to canonical storefront routes', () => {
      expect(buildAgentPolicyUrls('https://ogabassey.com')).toEqual({
        privacy_policy_url: 'https://ogabassey.com/privacy',
        return_policy_url: 'https://ogabassey.com/returns',
        shipping_policy_url: 'https://ogabassey.com/shipping',
        terms_of_service_url: 'https://ogabassey.com/terms',
      });
    });

    it('trims policy base URLs with trailing slashes', () => {
      expect(buildAgentPolicyUrls('https://ogabassey.com///')).toEqual({
        privacy_policy_url: 'https://ogabassey.com/privacy',
        return_policy_url: 'https://ogabassey.com/returns',
        shipping_policy_url: 'https://ogabassey.com/shipping',
        terms_of_service_url: 'https://ogabassey.com/terms',
      });
    });

    it('builds relative policy URLs when base URL is empty', () => {
      expect(buildAgentPolicyUrls('')).toEqual({
        privacy_policy_url: '/privacy',
        return_policy_url: '/returns',
        shipping_policy_url: '/shipping',
        terms_of_service_url: '/terms',
      });
    });

    it('returns predictable policy URLs for base URLs without a protocol', () => {
      expect(buildAgentPolicyUrls('ogabassey.com')).toEqual({
        privacy_policy_url: 'ogabassey.com/privacy',
        return_policy_url: 'ogabassey.com/returns',
        shipping_policy_url: 'ogabassey.com/shipping',
        terms_of_service_url: 'ogabassey.com/terms',
      });
    });

    it('returns predictable policy URLs for malformed base URLs', () => {
      expect(buildAgentPolicyUrls('ht!tp://')).toEqual({
        privacy_policy_url: 'ht!tp:/privacy',
        return_policy_url: 'ht!tp:/returns',
        shipping_policy_url: 'ht!tp:/shipping',
        terms_of_service_url: 'ht!tp:/terms',
      });
    });

    it('throws for nullish policy base URLs outside the typed contract', () => {
      expect(() =>
        buildAgentPolicyUrls(null as unknown as string)
      ).toThrowError(TypeError);
      expect(() =>
        buildAgentPolicyUrls(undefined as unknown as string)
      ).toThrowError(TypeError);
    });
  });
});
