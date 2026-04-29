import { describe, expect, it } from 'vitest';
import { STOREFRONT_POLICY_ROUTES } from '@/config/storefront-policy-routes';

describe('STOREFRONT_POLICY_ROUTES', () => {
  it('keeps storefront policy routes canonical', () => {
    const expectedRoutes = {
      privacy: '/privacy',
      returns: '/returns',
      shipping: '/shipping',
      terms: '/terms',
    };

    const actual = STOREFRONT_POLICY_ROUTES;

    expect(actual).toEqual(expectedRoutes);
  });

  it('does not include unexpected policy route keys', () => {
    const expectedKeys = ['privacy', 'returns', 'shipping', 'terms'];

    const actualKeys = Object.keys(STOREFRONT_POLICY_ROUTES).sort();
    const sortedExpectedKeys = [...expectedKeys].sort();

    expect(actualKeys).toEqual(sortedExpectedKeys);
  });
});
