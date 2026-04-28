import { describe, expect, it } from 'vitest';
import { STOREFRONT_POLICY_ROUTES } from '@/config/storefront-policy-routes';

describe('STOREFRONT_POLICY_ROUTES', () => {
  it('keeps storefront policy routes canonical', () => {
    expect(STOREFRONT_POLICY_ROUTES).toEqual({
      privacy: '/privacy',
      returns: '/returns',
      shipping: '/shipping',
      terms: '/terms',
    });
  });
});
