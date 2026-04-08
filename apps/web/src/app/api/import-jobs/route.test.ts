import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void Promise.resolve()
        .then(callback)
        .catch(() => undefined);
    },
  };
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-service', () => ({
  createImportStoragePath: vi.fn(),
  validateImportFile: vi.fn(),
}));

vi.mock('@/lib/import-jobs/kickoff-import-job', () => ({
  startImportJob: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-route-auth', () => ({
  hasImportRoutePermission: vi.fn(),
  resolveImportRouteContext: vi.fn(),
}));

import type { NextRequest as ActualNextRequest } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import {
  createImportStoragePath,
  validateImportFile,
} from '@/lib/import-jobs/import-job-service';
import { startImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';

function createRequest(body: FormData) {
  return {
    nextUrl: new URL('http://localhost/api/import-jobs'),
    formData: vi.fn().mockResolvedValue(body),
  } as unknown as ActualNextRequest;
}

async function flushAfterCallbacks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createSupabaseMock() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const insertQuery = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  insertQuery.insert.mockReturnValue(insertQuery);
  insertQuery.select.mockReturnValue(insertQuery);
  insertQuery.single.mockResolvedValue({
    data: {
      id: 'job-1',
      merchant_id: 'merchant-1',
      created_by: 'user-1',
      source_platform: 'bumpa',
      entity_type: 'orders',
      status: 'uploaded',
      original_filename: 'orders.csv',
      storage_path: 'merchant-1/orders/orders.csv',
      content_type: 'text/csv',
      file_size_bytes: 12,
      total_rows: 0,
      processed_rows: 0,
      summary: {},
      error: null,
      created_at: '2026-03-22T10:00:00.000Z',
      committed_at: null,
      notified_at: null,
      completed_at: null,
    },
    error: null,
  });

  return {
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
      })),
    },
    from: vi.fn(() => insertQuery),
    __mocks: {
      insertQuery,
      remove,
      upload,
    },
  };
}

describe('POST /api/import-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(hasImportRoutePermission).mockReturnValue(true);
    vi.mocked(validateImportFile).mockReturnValue(null);
    vi.mocked(createImportStoragePath).mockReturnValue(
      'merchant-1/orders/orders.csv'
    );
  });

  it('returns 403 when csrf validation fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {} as never,
    });
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const formData = new FormData();
    const response = await POST(createRequest(formData));

    expect(response.status).toBe(403);
  });

  it('returns 429 when the upload rate limit is exceeded', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock(),
      } as never,
    });
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const formData = new FormData();
    const response = await POST(createRequest(formData));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: 'Rate limit exceeded',
      code: 'rate_limited',
    });
  });

  it('returns 400 when the file is missing', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock(),
      } as never,
    });

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'CSV file is required',
      code: 'missing_file',
    });
  });

  it('returns 403 when the merchant lacks permission for the entity type', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock(),
      } as never,
    });
    vi.mocked(hasImportRoutePermission).mockReturnValue(false);

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden',
    });
  });

  it('returns 400 when file validation fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock(),
      } as never,
    });
    vi.mocked(validateImportFile).mockReturnValue(
      'Unsupported CSV content type'
    );

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');
    formData.set(
      'file',
      new File(['id\n1'], 'orders.csv', { type: 'application/json' })
    );

    const response = await POST(createRequest(formData) as NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported CSV content type',
      code: 'invalid_file',
    });
  });

  it('creates an import job and triggers the worker for that job before returning', async () => {
    const supabaseMock = createSupabaseMock();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');
    formData.set(
      'file',
      new File(['id\n1'], 'orders.csv', { type: 'text/csv' })
    );

    const response = await POST(createRequest(formData) as NextRequest);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        job: expect.objectContaining({
          id: 'job-1',
          status: 'uploaded',
        }),
      })
    );
    expect(supabaseMock.storage.from).toHaveBeenCalledWith('migration-imports');
    expect(supabaseMock.__mocks.upload).toHaveBeenCalledWith(
      'merchant-1/orders/orders.csv',
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: 'text/csv',
        upsert: false,
      })
    );
    expect(supabaseMock.from).toHaveBeenCalledWith('import_jobs');
    expect(supabaseMock.__mocks.insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        created_by: 'user-1',
        entity_type: 'orders',
        source_platform: 'bumpa',
        status: 'uploaded',
        original_filename: 'orders.csv',
        storage_path: 'merchant-1/orders/orders.csv',
      })
    );
    await flushAfterCallbacks();
    expect(startImportJob).toHaveBeenCalledWith('job-1', 'http://localhost');
  });

  it('returns 500 when storage upload fails', async () => {
    const supabaseMock = createSupabaseMock();
    supabaseMock.__mocks.upload.mockResolvedValue({
      error: { message: 'upload failed' },
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');
    formData.set(
      'file',
      new File(['id\n1'], 'orders.csv', { type: 'text/csv' })
    );

    const response = await POST(createRequest(formData) as NextRequest);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to upload CSV file',
      code: 'upload_failed',
    });
    expect(startImportJob).not.toHaveBeenCalled();
  });

  it('returns 500 when creating the import job fails', async () => {
    const supabaseMock = createSupabaseMock();
    supabaseMock.__mocks.insertQuery.single.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');
    formData.set(
      'file',
      new File(['id\n1'], 'orders.csv', { type: 'text/csv' })
    );

    const response = await POST(createRequest(formData) as NextRequest);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to create import job',
      code: 'job_create_failed',
    });
    expect(startImportJob).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded file when creating the import job fails', async () => {
    const supabaseMock = createSupabaseMock();
    supabaseMock.__mocks.insertQuery.single.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');
    formData.set(
      'file',
      new File(['id\n1'], 'orders.csv', { type: 'text/csv' })
    );

    const response = await POST(createRequest(formData) as NextRequest);

    expect(response.status).toBe(500);
    expect(supabaseMock.__mocks.remove).toHaveBeenCalledWith([
      'merchant-1/orders/orders.csv',
    ]);
    expect(startImportJob).not.toHaveBeenCalled();
  });

  it('returns 202 even when post-response kickoff rejects', async () => {
    const supabaseMock = createSupabaseMock();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });
    vi.mocked(startImportJob).mockRejectedValue(
      new Error('worker unavailable')
    );

    const formData = new FormData();
    formData.set('entityType', 'orders');
    formData.set('sourcePlatform', 'bumpa');
    formData.set(
      'file',
      new File(['id\n1'], 'orders.csv', { type: 'text/csv' })
    );

    const response = await POST(createRequest(formData) as NextRequest);

    expect(response.status).toBe(202);
    await flushAfterCallbacks();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        job: expect.objectContaining({
          id: 'job-1',
          status: 'uploaded',
        }),
      })
    );
    expect(startImportJob).toHaveBeenCalledWith('job-1', 'http://localhost');
  });
});
