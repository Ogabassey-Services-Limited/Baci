import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { noStoreMock } = vi.hoisted(() => ({
  noStoreMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_noStore: noStoreMock,
}));

vi.mock('@/lib/import-jobs/import-job-route-auth', () => ({
  getImportJobForMerchant: vi.fn(),
  hasImportRoutePermission: vi.fn(),
  resolveImportRouteContext: vi.fn(),
}));

import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  type ImportRouteContext,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';
import { GET } from './route';

const jobId = '00000000-0000-4000-8000-000000000001';

function createRouteContext(): ImportRouteContext {
  return {
    merchantContext: {
      merchantId: 'merchant-1',
    } as ImportRouteContext['merchantContext'],
    supabase: {
      from: vi.fn(() => {
        const query = {
          select: vi.fn(),
          eq: vi.fn(),
          in: vi.fn(),
          order: vi.fn(),
          range: vi.fn(),
        };
        query.select.mockReturnValue(query);
        query.eq.mockReturnValue(query);
        query.in.mockReturnValue(query);
        query.order.mockReturnValue(query);
        query.range.mockResolvedValue({
          data: [
            {
              id: 'row-1',
              row_number: 2,
              source_external_id: 'ext-1',
              row_status: 'create',
              source_payload: {},
              normalized_payload: {},
              validation_errors: [],
              meta: {},
            },
          ],
          count: 1,
          error: null,
        });
        return query;
      }),
    } as unknown as ImportRouteContext['supabase'],
    userId: 'user-1',
  };
}

function createImportJob(
  overrides?: Partial<Pick<ImportJobRecord, 'id' | 'entity_type' | 'status'>>
): ImportJobRecord {
  return {
    id: overrides?.id || jobId,
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa',
    entity_type: overrides?.entity_type || 'orders',
    status: overrides?.status || 'preview_ready',
    original_filename: 'orders.csv',
    storage_path: 'merchant-1/orders/orders.csv',
    content_type: 'text/csv',
    file_size_bytes: 12,
    total_rows: 1,
    processed_rows: 1,
    summary: {},
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
    committed_at: null,
    notified_at: null,
    completed_at: null,
  };
}

describe('GET /api/import-jobs/[jobId]/rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: createRouteContext(),
    });
    vi.mocked(hasImportRoutePermission).mockReturnValue(true);
    vi.mocked(getImportJobForMerchant).mockResolvedValue(createImportJob());
  });

  it('disables caching via unstable_noStore', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    expect(noStoreMock).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for invalid pagination parameters', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=0&pageSize=999`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid pagination query',
      code: 'invalid_pagination',
    });
  });

  it('returns 400 for unsupported preview filters', async () => {
    const routeContext = createRouteContext();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: routeContext,
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?filter=unsupported&page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(400);
    expect(getImportJobForMerchant).not.toHaveBeenCalled();
    expect(routeContext.supabase.from).not.toHaveBeenCalled();
  });

  it('returns 401 when authentication fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValueOnce({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      }) as never,
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(401);
    expect(getImportJobForMerchant).not.toHaveBeenCalled();
  });

  it('returns 403 when the merchant lacks permission for the import entity', async () => {
    vi.mocked(hasImportRoutePermission).mockReturnValue(false);

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(403);
  });

  it('returns 404 when the import job does not exist', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(404);
  });

  it('returns 500 when the preview row query fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        ...createRouteContext(),
        supabase: {
          from: vi.fn(() => {
            const query = {
              select: vi.fn(),
              eq: vi.fn(),
              in: vi.fn(),
              order: vi.fn(),
              range: vi.fn(),
            };
            query.select.mockReturnValue(query);
            query.eq.mockReturnValue(query);
            query.in.mockReturnValue(query);
            query.order.mockReturnValue(query);
            query.range.mockResolvedValue({
              data: null,
              count: null,
              error: { message: 'boom' },
            });
            return query;
          }),
        } as unknown as ImportRouteContext['supabase'],
      },
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(500);
  });

  it('returns an empty rows payload when the selected page has no preview rows', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        ...createRouteContext(),
        supabase: {
          from: vi.fn(() => {
            const query = {
              select: vi.fn(),
              eq: vi.fn(),
              in: vi.fn(),
              order: vi.fn(),
              range: vi.fn(),
            };
            query.select.mockReturnValue(query);
            query.eq.mockReturnValue(query);
            query.in.mockReturnValue(query);
            query.order.mockReturnValue(query);
            query.range.mockResolvedValue({
              data: [],
              count: 0,
              error: null,
            });
            return query;
          }),
        } as unknown as ImportRouteContext['supabase'],
      },
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=2&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      rows: [],
      pagination: {
        page: 2,
        pageSize: 25,
        total: 0,
      },
    });
  });

  it('accepts the maximum pageSize boundary', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=100`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
  });

  it('filters preview rows to importable actions when requested', async () => {
    const routeContext = createRouteContext();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: routeContext,
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?filter=importable&page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    const query = vi.mocked(routeContext.supabase.from).mock.results[0]
      ?.value as {
      in: ReturnType<typeof vi.fn>;
    };
    expect(query.in).toHaveBeenCalledWith('row_status', ['create', 'update']);
  });

  it('filters preview rows to invalid actions when requested', async () => {
    const routeContext = createRouteContext();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: routeContext,
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?filter=needs_fix&page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    const query = vi.mocked(routeContext.supabase.from).mock.results[0]
      ?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(query.eq).toHaveBeenCalledWith('row_status', 'invalid');
  });

  it('returns paginated preview rows for the selected job', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/import-jobs/${jobId}/rows?page=1&pageSize=25`
      ),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      rows: [
        expect.objectContaining({
          id: 'row-1',
          row_number: 2,
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
      },
    });
  });
});
