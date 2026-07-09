import { describe, expect, it } from 'vitest';
import { aggregateWebsitePerformance } from './website-performance-aggregation';

describe('aggregateWebsitePerformance', () => {
  it('normalizes the live top-products RPC shape', () => {
    const summary = aggregateWebsitePerformance(
      [
        {
          id: 'product-1',
          name: 'Phone',
          units: 3,
          total_sold: 3,
          total_revenue: 5000,
        },
      ],
      null
    );

    expect(summary.bestSeller).toEqual({
      id: 'product-1',
      name: 'Phone',
      revenue: 5000,
      units_sold: 3,
    });
  });

  it('normalizes database-aggregated search and conversion metrics', () => {
    const summary = aggregateWebsitePerformance(null, {
      mostSearched: { query: 'iphone', count: 12 },
      topConverting: {
        id: 'product-1',
        name: 'Phone',
        purchases: 3,
        conversionRate: 25,
        views: 12,
      },
    });

    expect(summary.mostSearched).toEqual({ query: 'iphone', count: 12 });
    expect(summary.topConverting).toEqual({
      id: 'product-1',
      name: 'Phone',
      conversionRate: 25,
    });
  });

  it('rejects empty or zero-value database summaries', () => {
    const summary = aggregateWebsitePerformance(null, {
      mostSearched: { query: '', count: 0 },
      topConverting: {
        id: 'product-1',
        name: 'Phone',
        purchases: 0,
        conversionRate: 0,
        views: 12,
      },
    });

    expect(summary.mostSearched).toBeNull();
    expect(summary.topConverting).toBeNull();

    const impossibleSummary = aggregateWebsitePerformance(null, {
      topConverting: {
        id: 'product-1',
        name: 'Phone',
        purchases: 3,
        conversionRate: 300,
        views: 1,
      },
    });
    expect(impossibleSummary.topConverting).toBeNull();
  });

  it('rejects RPC conversion metrics below the minimum sample size', () => {
    const summary = aggregateWebsitePerformance(null, {
      topConverting: {
        id: 'product-1',
        name: 'Phone',
        purchases: 1,
        conversionRate: 100,
        views: 1,
      },
    });

    expect(summary.topConverting).toBeNull();
  });

  it('aggregates every paginated fallback row using canonical event shapes', () => {
    const views = Array.from({ length: 10 }, () => ({
      event_type: 'product_view',
      event_data: { items: [{ id: 'product-1', name: 'Phone' }] },
    }));
    const purchases = Array.from({ length: 5 }, () => ({
      event_type: 'purchase',
      event_data: { items: [{ id: 'product-1', name: 'Phone' }] },
    }));
    const summary = aggregateWebsitePerformance(null, [
      { event_type: 'search', event_data: { search_term: 'iphone' } },
      { event_type: 'search', event_data: { query: 'IPHONE' } },
      ...views,
      ...purchases,
    ]);

    expect(summary.mostSearched).toEqual({ query: 'iphone', count: 2 });
    expect(summary.topConverting).toEqual({
      id: 'product-1',
      name: 'Phone',
      conversionRate: 50,
    });
  });

  it('ignores malformed fallback rows and preserves known product names', () => {
    const views = Array.from({ length: 10 }, () => ({
      event_type: 'product_view',
      event_data: {
        product_id: 'product-1',
        product_name: 'Phone',
        items: [{ id: 'product-1' }],
      },
    }));
    const purchases = Array.from({ length: 5 }, () => ({
      event_type: 'purchase',
      event_data: { items: [{ id: 'product-1', name: 'Phone' }] },
    }));

    const summary = aggregateWebsitePerformance(null, [
      null,
      'malformed',
      { event_data: {} },
      ...views,
      ...purchases,
    ]);

    expect(summary.topConverting).toEqual({
      id: 'product-1',
      name: 'Phone',
      conversionRate: 50,
    });
  });
});
