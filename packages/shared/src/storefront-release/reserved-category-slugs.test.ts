import { describe, expect, it } from 'vitest';
import { STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS } from './reserved-category-slugs';

const EXPECTED_RESERVED_SLUGS = [
  'about',
  'account',
  'api',
  'auth',
  'baci-relay',
  'best-sellers',
  'blog',
  'builder',
  'cart',
  'category',
  'checkout',
  'compare',
  'contact',
  'dashboard',
  'delete-account',
  'faq',
  'featured',
  'forgot-password',
  'imei-check',
  'login',
  'member-status',
  'my-account',
  'new-arrivals',
  'on-sale',
  'onboarding',
  'order-success',
  'pages',
  'privacy',
  'privacy-policy',
  'product',
  'product-category',
  'products',
  'quiz',
  'receipts',
  'repair',
  'repairs',
  'reset-password',
  'returns',
  'reviews',
  'search',
  'shipping',
  'signup',
  'sitemap',
  'staff',
  'storefront',
  'swap',
  'terms',
  'terms-and-conditions',
  'terms-of-service',
  'track-order',
  'unlock-orders',
  'update-password',
  'verify',
  'wallet',
  'warranty',
  'wishlist',
] as const;

describe('STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS', () => {
  it('pins the complete closed storefront route-collision vocabulary', () => {
    expect([...STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS]).toEqual(
      EXPECTED_RESERVED_SLUGS
    );
  });
});
