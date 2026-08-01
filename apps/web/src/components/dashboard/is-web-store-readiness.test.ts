import { describe, expect, it } from 'vitest';
import { isWebStoreReadiness } from './is-web-store-readiness';

const readiness = {
  merchantId: 'merchant-1',
  surface: 'web',
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
      description: 'Add a published product',
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
} as const;

describe('isWebStoreReadiness', () => {
  it('accepts a valid web readiness payload', () => {
    expect(isWebStoreReadiness(readiness)).toBe(true);
  });

  it('rejects a valid payload for another surface', () => {
    expect(isWebStoreReadiness({ ...readiness, surface: 'mobile' })).toBe(
      false
    );
  });

  it('rejects malformed readiness data', () => {
    expect(isWebStoreReadiness({ ...readiness, merchantId: '' })).toBe(false);
  });

  it.each([
    null,
    undefined,
    'readiness',
    1,
    [],
  ])('rejects non-object readiness input: %j', (value) => {
    expect(isWebStoreReadiness(value)).toBe(false);
  });
});
