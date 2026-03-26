import { describe, expect, it, vi } from 'vitest';
import { buildBumpaProductPreview } from '@/lib/imports/bumpa/build-bumpa-product-preview';

const baseRow = {
  'Product ID': '4527981',
  'Variant ID': '',
  'Row Type': 'product',
  Title: 'Iphone 17 Pro',
  SKU: '',
  'Variant Name': '',
  Barcode: '',
  Description: '',
  Details: '',
  Unit: 'pc',
  Price: '2000000.00',
  Sales: '',
  Cost: '',
  Stock: '0',
  'Weight (kg)': '',
  Type: 'simple',
  Status: '0',
  Featured: '0',
  'Manage Stock': '1',
  'Sales Count': '1',
  'Ratings Cache': '',
  'Ratings Count': '0',
  'Currency Code': 'NGN',
  'Is Demo': '0',
  'Is Active': '1',
  'Min Order Qty': '1',
  'Max Order Qty': '',
  Collections: '',
  'Options Names': '',
  'Options Values': '',
  'Main Image': 'https://example.com/default.png',
  'Additional Images': '',
  'SEO Title': '',
  'SEO Description': '',
  'Product Type': 'Phones',
  Vendor: 'Apple',
  Gender: '',
  'Age Group': '',
  Condition: 'new',
  'Google Product Category': '',
  'Created At': '2026-03-21 14:14:25',
  'Updated At': '2026-03-21 14:15:25',
  Source: '',
  'Source ID': '',
};

describe('buildBumpaProductPreview', () => {
  it('builds normalized product preview rows', async () => {
    const result = await buildBumpaProductPreview({
      rows: [baseRow],
      existingProducts: [],
    });

    expect(result.summary.createCount).toBe(1);
    expect(result.rows[0]?.payload).toMatchObject({
      title: 'Iphone 17 Pro',
      price: 2000000,
      status: 'active',
    });
  });

  it('marks repeated product ids as duplicates', async () => {
    const result = await buildBumpaProductPreview({
      rows: [baseRow, { ...baseRow }],
      existingProducts: [],
    });

    expect(result.rows[1]?.rowStatus).toBe('duplicate');
    expect(result.summary.duplicateCount).toBe(1);
  });

  it('marks existing imported products as updates', async () => {
    const result = await buildBumpaProductPreview({
      rows: [baseRow],
      existingProducts: [
        {
          id: 'product-1',
          name: 'Iphone 17 Pro',
          sku: null,
          price: 2000000,
          externalSource: 'bumpa',
          externalId: '4527981',
        },
      ],
    });

    expect(result.rows[0]?.rowStatus).toBe('update');
  });

  it('marks invalid rows and increments the invalid summary count', async () => {
    const result = await buildBumpaProductPreview({
      rows: [
        {
          ...baseRow,
          'Product ID': '',
          Title: '',
        },
      ],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('invalid');
    expect(result.summary.invalidRows).toBe(1);
  });

  it('reports live row progress while building product previews', async () => {
    const onProgress = vi.fn();

    await buildBumpaProductPreview({
      rows: [
        baseRow,
        { ...baseRow, 'Product ID': '4527982', Title: 'Iphone 17 Air' },
      ],
      existingProducts: [],
      onProgress,
    });

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      processedRows: 1,
      totalRows: 2,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      processedRows: 2,
      totalRows: 2,
    });
  });

  it('reports progress for duplicate rows before the early exit branch', async () => {
    const onProgress = vi.fn();

    const result = await buildBumpaProductPreview({
      rows: [baseRow, { ...baseRow }],
      existingProducts: [],
      onProgress,
    });

    expect(result.rows[1]?.rowStatus).toBe('duplicate');
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      processedRows: 1,
      totalRows: 2,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      processedRows: 2,
      totalRows: 2,
    });
  });

  it('continues building product previews when progress reporting fails', async () => {
    const result = await buildBumpaProductPreview({
      rows: [baseRow],
      existingProducts: [],
      onProgress: vi.fn().mockRejectedValue(new Error('boom')),
    });

    expect(result.summary.totalRows).toBe(1);
    expect(result.rows[0]?.rowStatus).toBe('create');
  });
});
