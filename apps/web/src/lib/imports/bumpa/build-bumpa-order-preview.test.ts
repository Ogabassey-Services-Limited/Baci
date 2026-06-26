import { describe, expect, it, vi } from 'vitest';
import { buildBumpaOrderPreview } from '@/lib/imports/bumpa/build-bumpa-order-preview';

const baseRow = {
  id: '4196546',
  'Order Number': '06397',
  Products: 'Samsung A17 8gb 256gb (New) | Pouch And Screen Guard | Delivery',
  'Customer Name': 'Queen Banigo',
  'Customer Email': 'queenbanigo3@gmail.com',
  'Customer Phone': '',
  'Payment Status': 'PAID',
  Status: 'COMPLETED',
  'Shipping Status': 'UNFULFILLED',
  Channel: 'MOBILE',
  Origin: 'instagram',
  Total: '350250.00',
  'Sub Total': '350250.00',
  Discount: '0.00',
  'Amount Paid': '350250.00',
  'Amount Due': '0.00',
  'Order Date': '2026-03-19 15:00:43',
  'Created At': '2026-03-19',
  'Updated At': '2026-03-19',
  'Shipping Price': '0.00',
  Tax: '0.00',
  'Coupon Code': '',
  'Shipping Option': '',
  'Product SKU': ' |  | ',
  'Product Quantity': '1.00 | 1.00 | 1.00',
};

describe('buildBumpaOrderPreview', () => {
  it('builds normalized rows and infers receipt readiness', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [baseRow],
      existingOrders: [],
      existingProducts: [
        {
          id: 'product-phone',
          name: 'Samsung A17 8gb 256gb (New)',
          sku: null,
          price: 333250,
          externalSource: null,
          externalId: null,
        },
        {
          id: 'product-pouch',
          name: 'Pouch And Screen Guard',
          sku: null,
          price: 9000,
          externalSource: null,
          externalId: null,
        },
        {
          id: 'product-delivery',
          name: 'Delivery',
          sku: null,
          price: 8000,
          externalSource: null,
          externalId: null,
        },
      ],
    });

    expect(result.summary.totalRows).toBe(1);
    expect(result.summary.validRows).toBe(1);
    expect(result.summary.receiptReadyOrders).toBe(1);
    expect(result.rows[0]?.payload?.shippingStatus).toBe('delivered');
    expect(result.rows[0]?.payload?.items).toHaveLength(3);
    expect(result.rows[0]?.payload?.items[0]).toMatchObject({
      matched: true,
      productId: 'product-phone',
    });
  });

  it('carries rich address and product enrichment fields into the preview payload', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          Products: 'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261',
          'Product SKU': '',
          'Product Quantity': '1.00',
          best_address_full: '10 Marina, Lagos, Nigeria',
          best_address_street: '10 Marina',
          best_address_city: 'Marina',
          best_address_state: 'Lagos',
          best_address_country: 'Nigeria',
          best_address_zip: '100001',
          address_source: 'shipping',
          import_recommendation: 'review_phone_only',
          contact_quality: 'phone_only',
        },
      ],
      existingOrders: [],
      existingProducts: [
        {
          id: 'product-pixel',
          name: 'Google Pixel 7a 128GB (Premium Used)',
          sku: null,
          price: 425000,
          externalSource: null,
          externalId: null,
        },
      ],
    });

    expect(result.rows[0]?.payload?.shippingAddress).toEqual({
      fullAddress: '10 Marina, Lagos, Nigeria',
      address: '10 Marina',
      city: 'Marina',
      state: 'Lagos',
      country: 'Nigeria',
      postalCode: '100001',
      source: 'shipping',
    });
    expect(result.rows[0]?.payload?.importMetadata).toMatchObject({
      importRecommendation: 'review_phone_only',
      customerProfile: {
        contactQuality: 'phone_only',
      },
    });
    expect(result.rows[0]?.payload?.items[0]?.importMetadata).toMatchObject({
      bumpa: {
        normalized_product_name: 'Google Pixel 7a 128GB (Premium Used)',
        analytics_product_key: 'google-pixel-7a-128gb-premium-used',
        product_family: 'Google Pixel',
        fulfillment_identifiers: {
          imeis: ['351183326811261'],
        },
      },
    });
    expect(result.rows[0]?.payload?.items[0]).toMatchObject({
      productId: 'product-pixel',
      matched: true,
      matchSource: 'name',
    });
  });

  it('matches rich Bumpa product lines to stripped original-brand catalog names', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: 'pixel-original-brand',
          'Order Number': '06400',
          Products: 'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261',
          'Product SKU': '',
          'Product Quantity': '1.00',
        },
      ],
      existingOrders: [],
      existingProducts: [
        {
          id: 'product-pixel-original',
          name: 'Pixel 7a 128GB (Premium Used)',
          sku: null,
          price: 425000,
          externalSource: 'bumpa',
          externalId: 'bumpa-product-pixel',
        },
      ],
    });

    expect(result.rows[0]?.payload?.items[0]).toMatchObject({
      productId: 'product-pixel-original',
      matched: true,
      matchSource: 'name',
    });
  });

  it('marks review-excluded rich import rows invalid before commit', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          'Customer Name': 'Keza Africa',
          import_recommendation: 'exclude_proxy_or_company',
          import_reason:
            'Customer appears to be a company/proxy purchaser, not the final receipt owner.',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.summary.invalidRows).toBe(1);
    expect(result.rows[0]).toMatchObject({
      rowStatus: 'invalid',
      payload: null,
      meta: {
        importRecommendation: 'exclude_proxy_or_company',
      },
    });
    expect(result.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Skipped by migration review (exclude_proxy_or_company)'
        ),
        expect.stringContaining(
          'Customer appears to be a company/proxy purchaser, not the final receipt owner.'
        ),
      ])
    );
  });

  it('marks duplicate external ids in the same file', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [baseRow, { ...baseRow }],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[1]?.rowStatus).toBe('duplicate');
    expect(result.summary.duplicateCount).toBe(1);
  });

  it('reserves skipped external ids for duplicate detection', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          import_recommendation: 'exclude_proxy_or_company',
        },
        {
          ...baseRow,
          'Order Number': '06398',
          import_recommendation: '',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('invalid');
    expect(result.rows[1]?.rowStatus).toBe('duplicate');
    expect(result.summary.duplicateCount).toBe(1);
  });

  it('marks duplicate order numbers in the same upload as invalid for both rows', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [baseRow, { ...baseRow, id: '4196547' }],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('invalid');
    expect(result.rows[1]?.rowStatus).toBe('invalid');
    expect(result.rows[0]?.errors).toContain(
      'Order number 06397 is duplicated in the upload'
    );
    expect(result.rows[1]?.errors).toContain(
      'Order number 06397 is duplicated in the upload'
    );
  });

  it('marks conflicting order numbers as invalid', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [baseRow],
      existingOrders: [
        {
          id: 'existing-order',
          orderNumber: '06397',
          externalSource: null,
          externalId: null,
        },
      ],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('invalid');
    expect(result.rows[0]?.errors?.[0]).toContain('already exists');
  });

  it('classifies phone-only customers in the preview summary', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: 'order-2',
          'Customer Email': '',
          'Customer Phone': '08122221631',
          'Payment Status': 'PARTIALLY_PAID',
          Status: 'OPEN',
          'Shipping Status': '',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.summary.phoneOnlyCustomers).toBe(1);
    expect(result.rows[0]?.payload?.receiptReady).toBe(false);
  });

  it('marks paid orders as receipt-ready even when shipping is not updated', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: 'order-3',
          'Order Number': '06398',
          'Payment Status': 'PAID',
          Status: 'OPEN',
          'Shipping Status': '',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.summary.receiptReadyOrders).toBe(1);
    expect(result.rows[0]?.payload?.receiptReady).toBe(true);
  });

  it('reports live row progress while building previews', async () => {
    const onProgress = vi.fn();

    await buildBumpaOrderPreview({
      rows: [baseRow, { ...baseRow, id: '4196547', 'Order Number': '06398' }],
      existingOrders: [],
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

  it('continues building previews when progress reporting fails', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [baseRow],
      existingOrders: [],
      existingProducts: [],
      onProgress: vi.fn().mockRejectedValue(new Error('boom')),
    });

    expect(result.summary.totalRows).toBe(1);
    expect(result.rows[0]?.rowStatus).toBe('create');
  });

  it('falls back to the default chunk size when an invalid chunk size is provided', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [baseRow],
      existingOrders: [],
      existingProducts: [],
      chunkSize: 0,
    });

    expect(result.summary.totalRows).toBe(1);
    expect(result.rows[0]?.rowStatus).toBe('create');
  });

  it('keeps double-pipe laptop descriptions as a single import item', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: '3889870',
          'Order Number': '06320',
          Products:
            '*Lenovo Thinkpad T14 Gen 1 || 10th Gen || Intel core i5 || 16GB RAM || 512gb SSD || 14 inches screen || Windows 11 pro || UK used',
          'Customer Name': 'Oyinkan Aluko',
          'Customer Email': 'tzoyah8@gmail.com',
          'Product Quantity': '1.00',
          'Product SKU': '',
          Total: '450000.00',
          'Sub Total': '450000.00',
          'Amount Paid': '450000.00',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('create');
    expect(result.rows[0]?.payload?.items).toHaveLength(1);
    expect(result.rows[0]?.errors).toEqual([]);
  });

  it('uses quantity hints to avoid exploding mixed laptop-plus-accessory rows', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: '3791497',
          'Order Number': '05492',
          Products:
            'Dell Inspiron 7440-7304BLU 2-IN-1 CONVERTIBLE 14th Gen Intel Core TM 7 150U 1.8GHz up to 5.40GHz (LATEST MODEL) 512GB SSD | 16GB RAM | 14" (1920x1200) TOUCHSCREEN Display Windows 11 | ICE BLUE | BACKLIT KEYBOARD | | Dell Inspiron 16 Plus 7640 Intel Core T™ Ultra 7 155H 1.4Ghz up to 4.90GHz 1TB SSD | 16GB RAM | 16" (1920x1200) Display | Windows 11 BLUE | BACKLIT KEYBOARD | FingerPrint Reader | Samsung A56 256gb | Pouch | Screen Protector | Insurance | Delivery',
          'Customer Name': 'Shyft Power',
          'Customer Email': 'finance@shyftpower.com',
          'Customer Phone': '',
          'Product SKU': ' |  |  |  |  |  | ',
          'Product Quantity': '1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00',
          Total: '3661200.00',
          'Sub Total': '3661200.00',
          'Amount Paid': '3661200.00',
          'Order Date': '2025-11-26 10:20:03',
          'Created At': '2025-11-26',
          'Updated At': '2025-11-26',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('create');
    expect(result.rows[0]?.payload?.items).toHaveLength(7);
    expect(result.rows[0]?.errors).not.toContain(
      'One or more imported items are missing a product name'
    );
  });

  it('ignores a trailing solitary pipe after a single laptop description', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: '1516411',
          'Order Number': '02994',
          Products:
            'HP elitebook X360 1030 G2 || 7th Gen || Intel Core i5 || 16 GB || 256 GB SSD || Face ID || Backlit || 13.3 inch screen || Screen touch || Windows 11 |',
          'Customer Name': 'OGUNSEHINDE OLUWADUNSIN',
          'Customer Email': 'dundeeoguns@gmail.com',
          'Customer Phone': '',
          'Product SKU': '',
          'Product Quantity': '1.00',
          Total: '325000.00',
          'Sub Total': '325000.00',
          'Amount Paid': '325000.00',
          'Order Date': '2024-12-18 18:22:35',
          'Created At': '2024-12-18',
          'Updated At': '2024-12-18',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('create');
    expect(result.rows[0]?.payload?.items).toHaveLength(1);
    expect(result.rows[0]?.errors).toEqual([]);
  });

  it('accepts rows with blank customer names when an email exists', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: '1107127',
          'Order Number': '04151-1',
          Products: 'IPhone XR 64gb (Premium Used)',
          'Customer Name': '',
          'Customer Email': 'khenzobox@outlook.com',
          'Customer Phone': '',
          'Product Quantity': '1.00',
          'Product SKU': '',
          Total: '250000.00',
          'Sub Total': '250000.00',
          'Amount Paid': '250000.00',
          'Order Date': '2024-08-13 23:20:25',
          'Created At': '2024-08-13',
          'Updated At': '2024-08-13',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('create');
    expect(result.rows[0]?.payload?.customer.email).toBe(
      'khenzobox@outlook.com'
    );
  });

  it('marks fully anonymous rows invalid with a clear identity error', async () => {
    const result = await buildBumpaOrderPreview({
      rows: [
        {
          ...baseRow,
          id: '2250705',
          'Order Number': '05360',
          Products: 'iPhone 16 256gb (Brand New ) | Insurance | Charger',
          'Customer Name': '',
          'Customer Email': '',
          'Customer Phone': '',
          'Product SKU': ' |  | ',
          'Product Quantity': '1.00 | 1.00 | 1.00',
          Total: '1343000.00',
          'Sub Total': '1343000.00',
          'Amount Paid': '1343000.00',
          'Order Date': '2025-05-09 17:50:19',
          'Created At': '2025-05-09',
          'Updated At': '2025-05-09',
        },
      ],
      existingOrders: [],
      existingProducts: [],
    });

    expect(result.rows[0]?.rowStatus).toBe('invalid');
    expect(result.rows[0]?.errors).toContain(
      'Customer name, email, or phone is required'
    );
  });
});
