import { describe, expect, it } from 'vitest';
import { buildCategorySeoDecision } from './build-category-seo-decision';

describe('buildCategorySeoDecision', () => {
  it('orders and deduplicates hard category blockers', () => {
    expect(
      buildCategorySeoDecision({
        isStorePublished: false,
        isAvailable: false,
        querySucceeded: false,
        activeProductCount: 0,
      })
    ).toEqual({
      pageKind: 'category',
      index: false,
      follow: true,
      blockers: [
        'store_unpublished',
        'category_unavailable',
        'category_data_unavailable',
      ],
    });
  });

  it('blocks explicit unpublished and unavailable category facts', () => {
    expect(
      buildCategorySeoDecision({
        isStorePublished: false,
        isAvailable: false,
        querySucceeded: true,
        activeProductCount: 1,
      })
    ).toMatchObject({
      index: false,
      blockers: ['store_unpublished', 'category_unavailable'],
    });
  });

  it('keeps query failure distinct from an empty successful category', () => {
    expect(
      buildCategorySeoDecision({
        isStorePublished: true,
        isAvailable: true,
        querySucceeded: false,
        activeProductCount: 0,
      }).blockers
    ).toEqual(['category_data_unavailable']);
  });

  it('emits category_empty only for a successful zero-count category', () => {
    expect(
      buildCategorySeoDecision({
        isStorePublished: true,
        isAvailable: true,
        querySucceeded: true,
        activeProductCount: 0,
      }).blockers
    ).toEqual(['category_empty']);
  });
});
