import { describe, expect, it } from 'vitest';
import { buildComparisonMatrixExport } from './spec-matrix-export';

describe('buildComparisonMatrixExport', () => {
  it('exports cached agent-ready products with provenance and approved compare slugs', () => {
    const exported = buildComparisonMatrixExport({
      merchantId: 'merchant-1',
      storeUrl: 'https://ogabassey.com/',
      generatedAt: '2026-06-07T00:00:00.000Z',
      approvedCompareSlugs: [
        'phone-b-vs-phone-c',
        'phone-a-vs-phone-b',
        'phone-a-vs-phone-b',
      ],
      products: [
        {
          id: 'phone-a',
          slug: 'phone-a',
          name: 'Phone A',
          category_slug: 'smartphones',
          brand: 'Brand A',
          price: 100_000,
          manage_stock: false,
          stock_quantity: null,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-05T00:00:00.000Z',
          product_key_specs: {
            created_at: '2026-06-04T00:00:00.000Z',
            screen_size_inches: 6.8,
            chipset: 'Chip A',
            ram_gb: 8,
          },
        },
      ],
    });

    expect(exported.schema_version).toBe('comparison-matrix-v1');
    expect(exported.approved_compare_slugs).toEqual([
      'phone-a-vs-phone-b',
      'phone-b-vs-phone-c',
    ]);
    expect(exported.products[0]).toMatchObject({
      availability: 'InStock',
      inventory_policy: 'unmanaged',
      canonical_url: 'https://ogabassey.com/smartphones/phone-a',
      matrix_source: {
        source: 'catalog',
        source_updated_at: '2026-06-04T00:00:00.000Z',
        confidence: 'catalog_verified',
      },
    });
    expect(
      exported.products[0]?.comparison_detail_groups.length
    ).toBeGreaterThan(0);
    expect(exported.products[0]?.comparison_summary_rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Display', value: '6.8 inches' }),
        expect.objectContaining({ label: 'Processor', value: 'Chip A' }),
      ])
    );
  });

  it('marks managed zero-stock products out of stock and preserves deterministic product order', () => {
    const exported = buildComparisonMatrixExport({
      merchantId: 'merchant-1',
      storeUrl: 'https://ogabassey.com',
      generatedAt: '2026-06-07T00:00:00.000Z',
      approvedCompareSlugs: [],
      products: [
        {
          id: 'accessory-b',
          slug: 'case-b',
          name: 'Case B',
          category_slug: 'accessories',
          price: 20_000,
          manage_stock: true,
          stock_quantity: 0,
          created_at: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'phone-a',
          slug: 'phone-a',
          name: 'Phone A',
          category_slug: 'smartphones',
          price: 100_000,
          manage_stock: true,
          stock_quantity: 4,
        },
      ],
    });

    expect(exported.products.map((product) => product.slug)).toEqual([
      'case-b',
      'phone-a',
    ]);
    expect(exported.products[0]).toMatchObject({
      availability: 'OutOfStock',
      inventory_policy: 'managed',
    });
    expect(exported.products[0]?.matrix_source.source_updated_at).toBe(
      '2026-06-01T00:00:00.000Z'
    );
  });

  it('keeps managed products in stock when stock quantity is not reported', () => {
    const exported = buildComparisonMatrixExport({
      merchantId: 'merchant-1',
      storeUrl: 'https://ogabassey.com',
      generatedAt: '2026-06-07T00:00:00.000Z',
      approvedCompareSlugs: [],
      products: [
        {
          id: 'phone-managed-null-stock',
          slug: 'phone-managed-null-stock',
          name: 'Managed Null Stock Phone',
          category_slug: 'smartphones',
          price: 100_000,
          manage_stock: true,
          stock_quantity: null,
        },
      ],
    });

    expect(exported.products[0]).toMatchObject({
      availability: 'InStock',
      inventory_policy: 'managed',
    });
  });
});
