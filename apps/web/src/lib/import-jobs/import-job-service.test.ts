import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/imports/csv/parse-csv', () => ({
  parseCsvText: vi.fn(),
}));

vi.mock('@/lib/imports/bumpa/build-bumpa-order-preview', () => ({
  buildBumpaOrderPreview: vi.fn(),
}));

vi.mock('@/lib/imports/bumpa/build-bumpa-product-preview', () => ({
  buildBumpaProductPreview: vi.fn(),
}));

import { buildBumpaOrderPreview } from '@/lib/imports/bumpa/build-bumpa-order-preview';
import { buildBumpaProductPreview } from '@/lib/imports/bumpa/build-bumpa-product-preview';
import { parseCsvText } from '@/lib/imports/csv/parse-csv';
import {
  buildImportJobRowInserts,
  buildImportPreviewForJob,
  createImportStoragePath,
  mergeImportJobSummary,
  validateImportFile,
} from './import-job-service';

function createPreviewSummary() {
  return {
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    createCount: 1,
    updateCount: 0,
    duplicateCount: 0,
    claimableCustomers: 1,
    phoneOnlyCustomers: 0,
    anonymousCustomers: 0,
    unmatchedItems: 0,
    receiptReadyOrders: 1,
  };
}

function createSupabaseMock() {
  const download = vi.fn().mockResolvedValue({
    data: {
      text: vi.fn().mockResolvedValue('id\norder-1'),
    },
    error: null,
  });
  const customersQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  };
  customersQuery.select.mockReturnValue(customersQuery);
  customersQuery.eq.mockReturnValue(customersQuery);
  customersQuery.is.mockResolvedValue({
    data: [
      {
        id: 'customer-1',
        email: 'ada@example.com',
        phone: '+2347000000000',
        user_id: null,
      },
    ],
    error: null,
  });

  const ordersQuery = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  ordersQuery.select.mockReturnValue(ordersQuery);
  ordersQuery.eq.mockResolvedValue({
    data: [
      {
        id: 'order-1',
        order_number: 'ORD-1',
        external_source: 'bumpa',
        external_id: 'bumpa-1',
      },
    ],
    error: null,
  });

  const productsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  productsQuery.select.mockReturnValue(productsQuery);
  productsQuery.eq.mockResolvedValue({
    data: [
      {
        id: 'product-1',
        name: 'Phone',
        sku: 'SKU-1',
        price: 5000,
        external_source: 'bumpa',
        external_id: 'prod-1',
      },
    ],
    error: null,
  });

  return {
    storage: {
      from: vi.fn(() => ({
        download,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'customers') {
        return customersQuery;
      }

      if (table === 'orders') {
        return ordersQuery;
      }

      return productsQuery;
    }),
  } as unknown as SupabaseClient;
}

describe('import-job-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes upload filenames when creating storage paths', () => {
    const path = createImportStoragePath(
      'merchant-1',
      'orders',
      ' Ogabassey Orders (March).csv '
    );

    expect(path).toMatch(
      /^merchant-1\/orders\/\d+-[0-9a-f-]+-Ogabassey-Orders-March-.csv$/
    );
  });

  it('validates CSV files by extension, size, and mime type', () => {
    expect(
      validateImportFile(new File(['x'], 'orders.txt', { type: 'text/plain' }))
    ).toBe('Only CSV files are supported');

    expect(
      validateImportFile(
        new File([new Uint8Array(26 * 1024 * 1024)], 'orders.csv', {
          type: 'text/csv',
        })
      )
    ).toBe('CSV file exceeds the 25MB upload limit');

    expect(
      validateImportFile(
        new File(['x'], 'orders.csv', { type: 'application/json' })
      )
    ).toBe('Unsupported CSV content type');

    expect(
      validateImportFile(new File(['x'], 'orders.csv', { type: 'text/csv' }))
    ).toBeNull();
  });

  it('builds an order preview from parsed CSV rows and existing merchant data', async () => {
    const supabase = createSupabaseMock();
    const previewRow = {
      rowNumber: 2,
      sourceExternalId: 'bumpa-1',
      rowStatus: 'update' as const,
      errors: [],
      payload: {
        externalSourceId: 'bumpa-1',
        orderNumber: 'ORD-1',
      },
      meta: {},
    } as never;
    vi.mocked(parseCsvText).mockReturnValue({
      headers: ['id'],
      rows: [{ id: 'bumpa-1' }],
    });
    vi.mocked(buildBumpaOrderPreview).mockReturnValue({
      rows: [previewRow],
      summary: createPreviewSummary(),
    });

    const result = await buildImportPreviewForJob(supabase, {
      entity_type: 'orders',
      merchant_id: 'merchant-1',
      storage_path: 'merchant-1/orders/orders.csv',
    });

    expect(result.sourceRows).toEqual([{ id: 'bumpa-1' }]);
    expect(result.rows).toEqual([previewRow]);
    expect(result.totalRows).toBe(1);
    expect(buildBumpaOrderPreview).toHaveBeenCalledWith({
      rows: [{ id: 'bumpa-1' }],
      existingOrders: [
        {
          id: 'order-1',
          orderNumber: 'ORD-1',
          externalSource: 'bumpa',
          externalId: 'bumpa-1',
        },
      ],
      existingProducts: [
        {
          id: 'product-1',
          name: 'Phone',
          sku: 'SKU-1',
          price: 5000,
          externalSource: 'bumpa',
          externalId: 'prod-1',
        },
      ],
    });
  });

  it('builds product previews with source rows intact', async () => {
    const supabase = createSupabaseMock();
    vi.mocked(parseCsvText).mockReturnValue({
      headers: ['id'],
      rows: [{ id: 'prod-1' }],
    });
    vi.mocked(buildBumpaProductPreview).mockReturnValue({
      rows: [],
      summary: createPreviewSummary(),
    });

    const result = await buildImportPreviewForJob(supabase, {
      entity_type: 'products',
      merchant_id: 'merchant-1',
      storage_path: 'merchant-1/products/products.csv',
    });

    expect(result.sourceRows).toEqual([{ id: 'prod-1' }]);
    expect(result.totalRows).toBe(1);
    expect(buildBumpaProductPreview).toHaveBeenCalled();
  });

  it('maps preview rows into import_job_rows payloads', () => {
    const rows = buildImportJobRowInserts(
      'job-1',
      'merchant-1',
      [{ id: 'source-1' }],
      [
        {
          rowNumber: 2,
          sourceExternalId: 'source-1',
          rowStatus: 'create',
          errors: [],
          payload: {
            externalSourceId: 'source-1',
            title: 'Imported Product',
            price: 1500,
          } as never,
          meta: { matched: true },
        },
      ]
    );

    expect(rows).toEqual([
      {
        import_job_id: 'job-1',
        merchant_id: 'merchant-1',
        row_number: 2,
        source_external_id: 'source-1',
        row_status: 'create',
        source_payload: { id: 'source-1' },
        normalized_payload: {
          externalSourceId: 'source-1',
          title: 'Imported Product',
          price: 1500,
        },
        validation_errors: [],
        meta: { matched: true },
      },
    ]);
  });

  it('merges job summary updates without dropping existing keys', () => {
    expect(
      mergeImportJobSummary(
        { validRows: 8, invalidRows: 1 },
        { createdOrders: 8, invalidRows: 2 }
      )
    ).toEqual({
      validRows: 8,
      invalidRows: 2,
      createdOrders: 8,
    });
  });
});
