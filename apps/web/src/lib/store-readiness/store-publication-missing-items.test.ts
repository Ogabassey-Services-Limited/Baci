import { describe, expect, it } from 'vitest';
import type { StoreLaunchReadiness } from './build-store-launch-readiness';
import { getStorePublicationMissingItems } from './store-publication-missing-items';

function readinessWithIncompleteItem(
  id: StoreLaunchReadiness['items'][number]['id'],
  overrides: Partial<StoreLaunchReadiness> = {}
): StoreLaunchReadiness {
  return {
    merchantId: 'merchant-1',
    slug: 'merchant-one',
    activeProductCount: 0,
    totalProductCount: 0,
    completedRequired: 0,
    totalRequired: 1,
    isReady: false,
    items: [
      {
        id,
        label: id,
        description: id,
        completed: false,
        priority: 'required',
        category: 'store',
      },
    ],
    ...overrides,
  };
}

describe('getStorePublicationMissingItems', () => {
  it.each([
    ['verify_kyc', 'Identity verification (NIN, BVN, or CAC)'],
    ['bank_account', 'Bank account details'],
    ['payment_method', 'Payment method'],
    ['store_url', 'Store URL'],
    ['country', 'Country/region setting'],
    ['contact_info', 'Contact information (email or phone)'],
    ['first_product', 'At least one active product'],
  ] as const)('maps incomplete required %s to its publication copy', (id, copy) => {
    expect(
      getStorePublicationMissingItems(readinessWithIncompleteItem(id))
    ).toEqual([copy]);
  });

  it('preserves the inactive-products diagnostic using the canonical total count', () => {
    expect(
      getStorePublicationMissingItems(
        readinessWithIncompleteItem('first_product', { totalProductCount: 5 })
      )
    ).toEqual([
      'At least one active product (you have 5 product(s) but none are active - go to Products and activate them)',
    ]);
  });

  it.each([
    'recommended',
    'optional',
  ] as const)('excludes %s launch items from publication copy', (priority) => {
    const readiness = readinessWithIncompleteItem('verify_kyc');
    readiness.items[0].priority = priority;

    expect(getStorePublicationMissingItems(readiness)).toEqual([]);
  });
});
