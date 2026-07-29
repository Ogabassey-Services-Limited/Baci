import { describe, expect, it } from 'vitest';
import {
  isStoreReadiness,
  MOBILE_STORE_READINESS_ITEM_IDS,
  STORE_LAUNCH_READINESS_ITEM_IDS,
  STORE_READINESS_ITEM_IDS,
} from './store-readiness';

const VALID_READINESS_FIXTURE = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  surface: 'mobile',
  isReady: false,
  isPublished: false,
  completedRequired: 0,
  totalRequired: 1,
  completedRecommended: 0,
  totalRecommended: 0,
  overallProgress: 0,
  items: [
    {
      id: 'first_product',
      label: 'Publish your first product',
      description: 'You need at least one published product to start selling',
      completed: false,
      priority: 'required',
      category: 'products',
    },
  ],
  storeBuild: {
    starterStoreReady: true,
    aiStatus: 'not_started',
    latestJobId: null,
    canApplyAiDraft: false,
    message: 'Starter storefront is ready.',
  },
};

describe('store readiness contract', () => {
  it('accepts a complete platform-neutral readiness payload', () => {
    expect(isStoreReadiness(VALID_READINESS_FIXTURE)).toBe(true);
  });

  it.each([
    [
      'unknown item id',
      {
        ...VALID_READINESS_FIXTURE,
        items: [{ ...VALID_READINESS_FIXTURE.items[0], id: 'unknown' }],
      },
    ],
    [
      'embedded href',
      {
        ...VALID_READINESS_FIXTURE,
        items: [{ ...VALID_READINESS_FIXTURE.items[0], href: '/dashboard' }],
      },
    ],
    [
      'internal slug leakage',
      { ...VALID_READINESS_FIXTURE, slug: 'private-store-slug' },
    ],
    [
      'unexpected store build key',
      {
        ...VALID_READINESS_FIXTURE,
        storeBuild: {
          ...VALID_READINESS_FIXTURE.storeBuild,
          rawPaymentState: 'enabled',
        },
      },
    ],
    ['empty merchant id', { ...VALID_READINESS_FIXTURE, merchantId: '' }],
    ['unknown surface', { ...VALID_READINESS_FIXTURE, surface: 'desktop' }],
    [
      'web-only item on mobile',
      {
        ...VALID_READINESS_FIXTURE,
        items: [{ ...VALID_READINESS_FIXTURE.items[0], id: 'about_page' }],
      },
    ],
    ['invalid progress', { ...VALID_READINESS_FIXTURE, overallProgress: 101 }],
    [
      'required completion count inconsistent with items',
      { ...VALID_READINESS_FIXTURE, completedRequired: 1 },
    ],
    [
      'required total inconsistent with items',
      { ...VALID_READINESS_FIXTURE, totalRequired: 2 },
    ],
    [
      'recommended metrics inconsistent with items',
      { ...VALID_READINESS_FIXTURE, totalRecommended: 1 },
    ],
    [
      'overall progress inconsistent with items',
      { ...VALID_READINESS_FIXTURE, overallProgress: 50 },
    ],
    [
      'duplicate canonical item ids',
      {
        ...VALID_READINESS_FIXTURE,
        items: [
          VALID_READINESS_FIXTURE.items[0],
          VALID_READINESS_FIXTURE.items[0],
        ],
        totalRequired: 2,
      },
    ],
    [
      'missing store build status',
      { ...VALID_READINESS_FIXTURE, storeBuild: undefined },
    ],
  ])('rejects %s', (_name, value) => {
    expect(isStoreReadiness(value)).toBe(false);
  });

  it('keeps canonical launch readiness independent from surface item metrics', () => {
    expect(
      isStoreReadiness({ ...VALID_READINESS_FIXTURE, isReady: true })
    ).toBe(true);
  });

  it('keeps the stable item-id set explicit', () => {
    expect(STORE_READINESS_ITEM_IDS).toEqual([
      'verify_kyc',
      'bank_account',
      'payment_method',
      'store_url',
      'first_product',
      'country',
      'contact_info',
      'about_page',
      'privacy_policy',
      'terms_conditions',
      'business_address',
      'hero_carousel',
      'social_media',
      'analytics',
      'multiple_products',
    ]);
  });

  it('keeps mobile limited to implemented actions', () => {
    expect(MOBILE_STORE_READINESS_ITEM_IDS).not.toContain('about_page');
    expect(MOBILE_STORE_READINESS_ITEM_IDS).not.toContain('privacy_policy');
    expect(MOBILE_STORE_READINESS_ITEM_IDS).not.toContain('terms_conditions');
  });

  it('keeps the canonical required launch set explicit', () => {
    expect(STORE_LAUNCH_READINESS_ITEM_IDS).toEqual([
      'verify_kyc',
      'bank_account',
      'payment_method',
      'store_url',
      'first_product',
      'country',
      'contact_info',
    ]);
  });
});
