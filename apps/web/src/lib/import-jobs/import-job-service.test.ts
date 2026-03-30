import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getImportJobWorkerSecret: vi.fn(() => 'worker-secret'),
}));

vi.mock('@/lib/imports/csv/parse-csv', () => ({
  parseCsvText: vi.fn(),
}));

vi.mock('@/lib/imports/bumpa/build-bumpa-order-preview', () => ({
  buildBumpaOrderPreview: vi.fn(),
  buildBumpaOrderPreviewChunks: vi.fn(),
}));

vi.mock('@/lib/imports/bumpa/build-bumpa-product-preview', () => ({
  buildBumpaProductPreview: vi.fn(),
  buildBumpaProductPreviewChunks: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { buildBumpaOrderPreviewChunks } from '@/lib/imports/bumpa/build-bumpa-order-preview';
import { buildBumpaProductPreviewChunks } from '@/lib/imports/bumpa/build-bumpa-product-preview';
import { parseCsvText } from '@/lib/imports/csv/parse-csv';
import { logger } from '@/lib/logger';
import {
  buildImportJobRowInserts,
  buildImportPreviewChunksForJob,
  buildImportPreviewForJob,
  createImportStoragePath,
  mergeImportJobSummary,
  type PreviewBuildChunk,
  triggerImportWorker,
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
    vi.unstubAllGlobals();
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
    vi.mocked(parseCsvText).mockReturnValue({
      headers: ['id'],
      rows: [{ id: 'bumpa-1' }],
    });
    vi.mocked(buildBumpaOrderPreviewChunks).mockReturnValue(
      (async function* () {
        await Promise.resolve();
        yield {
          rows: [
            {
              rowNumber: 2,
              sourceExternalId: 'bumpa-1',
              rowStatus: 'update' as const,
              errors: [],
              payload: {
                externalSourceId: 'bumpa-1',
                orderNumber: 'ORD-1',
              },
              meta: {},
            } as never,
          ],
          partialSummary: createPreviewSummary(),
          processedRows: 1,
          totalRows: 1,
        };
      })()
    );

    const result = await buildImportPreviewForJob(supabase, {
      entity_type: 'orders',
      merchant_id: 'merchant-1',
      storage_path: 'merchant-1/orders/orders.csv',
    });

    expect(result.sourceRows).toEqual([{ id: 'bumpa-1' }]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        sourceExternalId: 'bumpa-1',
        rowStatus: 'update',
      }),
    ]);
    expect(result.totalRows).toBe(1);
    expect(buildBumpaOrderPreviewChunks).toHaveBeenCalledWith({
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
    vi.mocked(buildBumpaProductPreviewChunks).mockReturnValue(
      (async function* () {
        await Promise.resolve();
        yield {
          rows: [],
          partialSummary: createPreviewSummary(),
          processedRows: 1,
          totalRows: 1,
        };
      })()
    );

    const result = await buildImportPreviewForJob(supabase, {
      entity_type: 'products',
      merchant_id: 'merchant-1',
      storage_path: 'merchant-1/products/products.csv',
    });

    expect(result.sourceRows).toEqual([{ id: 'prod-1' }]);
    expect(result.totalRows).toBe(1);
    expect(buildBumpaProductPreviewChunks).toHaveBeenCalled();
  });

  it('reports preview progress while building order previews', async () => {
    const supabase = createSupabaseMock();
    const onProgress = vi.fn();

    vi.mocked(parseCsvText).mockReturnValue({
      headers: ['id'],
      rows: [{ id: 'bumpa-1' }, { id: 'bumpa-2' }],
    });
    vi.mocked(buildBumpaOrderPreviewChunks).mockImplementation(
      async function* ({ onProgress: builderProgress }) {
        await builderProgress?.({ processedRows: 1, totalRows: 2 });

        yield {
          rows: [],
          partialSummary: createPreviewSummary(),
          processedRows: 1,
          totalRows: 2,
        };
      }
    );

    await buildImportPreviewForJob(
      supabase,
      {
        entity_type: 'orders',
        merchant_id: 'merchant-1',
        storage_path: 'merchant-1/orders/orders.csv',
      },
      onProgress
    );

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      processedRows: 0,
      totalRows: 2,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      processedRows: 1,
      totalRows: 2,
    });
  });

  it('rebuilds the latest order preview rows from chunk updates', async () => {
    const supabase = createSupabaseMock();

    vi.mocked(parseCsvText).mockReturnValue({
      headers: ['id'],
      rows: [{ id: 'bumpa-1' }, { id: 'bumpa-2' }],
    });
    vi.mocked(buildBumpaOrderPreviewChunks).mockReturnValue(
      (async function* () {
        await Promise.resolve();
        yield {
          rows: [
            {
              rowNumber: 2,
              sourceExternalId: 'bumpa-1',
              rowStatus: 'create' as const,
              errors: [],
              payload: null,
              meta: {},
            },
          ],
          processedRows: 1,
          totalRows: 2,
          partialSummary: {
            ...createPreviewSummary(),
            totalRows: 1,
          },
        };

        yield {
          rows: [
            {
              rowNumber: 2,
              sourceExternalId: 'bumpa-1',
              rowStatus: 'invalid' as const,
              errors: ['duplicate'],
              payload: null,
              meta: {},
            },
            {
              rowNumber: 3,
              sourceExternalId: 'bumpa-2',
              rowStatus: 'invalid' as const,
              errors: ['duplicate'],
              payload: null,
              meta: {},
            },
          ],
          processedRows: 2,
          totalRows: 2,
          partialSummary: {
            ...createPreviewSummary(),
            validRows: 0,
            invalidRows: 2,
            createCount: 0,
            totalRows: 2,
          },
        };
      })()
    );

    const result = await buildImportPreviewForJob(supabase, {
      entity_type: 'orders',
      merchant_id: 'merchant-1',
      storage_path: 'merchant-1/orders/orders.csv',
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        rowStatus: 'invalid',
        errors: ['duplicate'],
      }),
      expect.objectContaining({
        rowNumber: 3,
        rowStatus: 'invalid',
        errors: ['duplicate'],
      }),
    ]);
    expect(result.summary).toEqual(
      expect.objectContaining({
        validRows: 0,
        invalidRows: 2,
        totalRows: 2,
      })
    );
  });

  it('yields persisted preview chunks with shared source rows', async () => {
    const supabase = createSupabaseMock();

    vi.mocked(parseCsvText).mockReturnValue({
      headers: ['id'],
      rows: [{ id: 'bumpa-1' }],
    });
    vi.mocked(buildBumpaOrderPreviewChunks).mockReturnValue(
      (async function* () {
        await Promise.resolve();
        yield {
          rows: [
            {
              rowNumber: 2,
              sourceExternalId: 'bumpa-1',
              rowStatus: 'create' as const,
              errors: [],
              payload: null,
              meta: {},
            },
          ],
          processedRows: 1,
          totalRows: 1,
          partialSummary: createPreviewSummary(),
        };
      })()
    );

    const chunks: PreviewBuildChunk[] = [];
    for await (const chunk of buildImportPreviewChunksForJob(supabase, {
      entity_type: 'orders',
      merchant_id: 'merchant-1',
      storage_path: 'merchant-1/orders/orders.csv',
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      expect.objectContaining({
        processedRows: 1,
        totalRows: 1,
        rows: [
          expect.objectContaining({
            rowNumber: 2,
            rowStatus: 'create',
          }),
        ],
        sourceRows: [{ id: 'bumpa-1' }],
      }),
    ]);
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

  it('triggers the worker with a targeted job payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await triggerImportWorker('https://usebaci.com', 'job-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://usebaci.com/api/import-jobs/worker',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer worker-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: 'job-123' }),
        cache: 'no-store',
      }
    );
  });

  it('throws when the worker responds with a non-ok status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      triggerImportWorker('https://usebaci.com', 'job-123')
    ).rejects.toThrow('Import worker trigger failed: 401 Unauthorized');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Import worker trigger returned non-OK response',
        origin: 'https://usebaci.com',
        jobId: 'job-123',
        status: 401,
        statusText: 'Unauthorized',
        body: 'Unauthorized',
      })
    );
  });
});
