import { describe, expect, it } from 'vitest';
import {
  buildProductSearchQuery,
  extractProductSearchIds,
  getProductSearchTotalCount,
  normalizeProductSearchText,
  orderRecordsByIds,
} from './product-search';

describe('normalizeProductSearchText', () => {
  it('normalizes compact device model terms into searchable tokens', () => {
    expect(normalizeProductSearchText('  iPhone14ProMax  ')).toBe(
      'iphone 14 pro max'
    );
  });

  it('normalizes common connectivity and sim formatting variants', () => {
    expect(normalizeProductSearchText('Wi-Fi only e-sim dual-sim')).toBe(
      'wifi only esim dual sim'
    );
  });
});

describe('buildProductSearchQuery', () => {
  it('returns normalized, tokenized, and compact forms', () => {
    expect(buildProductSearchQuery('Galaxy S24Ultra')).toEqual({
      compact: 'galaxys24ultra',
      normalized: 'galaxy s 24 ultra',
      tokens: ['galaxy', 's', '24', 'ultra'],
    });
  });
});

describe('search result helpers', () => {
  it('extracts ids and total count from ranked search rows', () => {
    const results = [
      { product_id: 'prod-1', relevance: 8.5, total_count: 2 },
      { product_id: 'prod-2', relevance: 7.2, total_count: 2 },
    ];

    expect(extractProductSearchIds(results)).toEqual(['prod-1', 'prod-2']);
    expect(getProductSearchTotalCount(results)).toBe(2);
  });

  it('parses Postgres string total counts into numbers', () => {
    const results = [
      { product_id: 'prod-1', relevance: 8.5, total_count: '2' },
      { product_id: 'prod-2', relevance: 7.2, total_count: 2 },
    ];

    expect(extractProductSearchIds(results)).toEqual(['prod-1', 'prod-2']);
    expect(getProductSearchTotalCount(results)).toBe(2);
  });

  it('reorders records to match ranked ids and drops missing rows', () => {
    expect(
      orderRecordsByIds(
        [
          { id: 'prod-2', name: 'iPhone 14 Pro Max' },
          { id: 'prod-1', name: 'iPhone 14 Pro' },
        ],
        ['prod-1', 'missing', 'prod-2']
      )
    ).toEqual([
      { id: 'prod-1', name: 'iPhone 14 Pro' },
      { id: 'prod-2', name: 'iPhone 14 Pro Max' },
    ]);
  });
});
