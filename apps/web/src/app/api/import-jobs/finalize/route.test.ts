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

vi.mock('@/env', () => ({
  isImportJobDirectUploadEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-route-auth', () => ({
  hasImportRoutePermission: vi.fn(() => true),
  resolveImportRouteContext: vi.fn(),
}));

vi.mock('@/lib/import-jobs/kickoff-import-job', () => ({
  kickoffImportJob: vi.fn(),
}));

import type { NextRequest as ActualNextRequest } from 'next/server';
import { isImportJobDirectUploadEnabled } from '@/env';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import { kickoffImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';

function createRequest(body: object) {
  return {
    nextUrl: new URL('http://localhost/api/import-jobs/finalize'),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as ActualNextRequest;
}

async function flushAfterCallbacks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createQuery<T>(result: { data: T; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  query.single.mockResolvedValue(result);
  query.update.mockReturnValue(query);

  return query;
}

function createSupabaseMock({
  existingJob,
  pendingUpload,
  storageExists = true,
}: {
  existingJob?: Record<string, unknown> | null;
  pendingUpload?: Record<string, unknown> | null;
  storageExists?: boolean;
}) {
  const exists = vi.fn().mockResolvedValue({
    data: storageExists,
    error: null,
  });
  const importJobsLookup = createQuery({
    data: existingJob ?? null,
    error: null,
  });
  const pendingLookup = createQuery({
    data: pendingUpload ?? null,
    error: null,
  });
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
      storage_path: 'merchant-1/orders/upload.csv',
      content_type: 'text/csv',
      file_size_bytes: 12,
      total_rows: 0,
      processed_rows: 0,
      summary: {},
      error: null,
      created_at: '2026-03-30T10:00:00.000Z',
      committed_at: null,
      notified_at: null,
      completed_at: null,
    },
    error: null,
  });
  const pendingUpdate = createQuery({
    data: {
      id: 'pending-1',
      claimed_at: '2026-03-30T10:05:00.000Z',
    },
    error: null,
  });
  let importJobsCallCount = 0;
  let pendingUploadsCallCount = 0;

  return {
    storage: {
      from: vi.fn(() => ({
        exists,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'import_jobs') {
        importJobsCallCount += 1;
        if (existingJob || importJobsCallCount === 1) {
          return importJobsLookup;
        }

        return insertQuery;
      }

      if (table === 'pending_import_uploads') {
        pendingUploadsCallCount += 1;
        return pendingUploadsCallCount === 1 ? pendingLookup : pendingUpdate;
      }

      return importJobsLookup;
    }),
    __mocks: {
      exists,
      importJobsLookup,
      insertQuery,
      pendingLookup,
      pendingUpdate,
    },
  };
}

describe('POST /api/import-jobs/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isImportJobDirectUploadEnabled).mockReturnValue(true);
    vi.mocked(hasImportRoutePermission).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
  });

  it('returns the existing job on idempotent retry', async () => {
    const supabaseMock = createSupabaseMock({
      existingJob: {
        id: 'job-1',
        status: 'uploaded',
      },
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const response = await POST(
      createRequest({
        clientUploadId: '11111111-1111-4111-8111-111111111111',
      }) as NextRequest
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      job: expect.objectContaining({ id: 'job-1', status: 'uploaded' }),
    });
    expect(supabaseMock.__mocks.insertQuery.insert).not.toHaveBeenCalled();
  });

  it('creates a job, marks the upload claimed, and triggers the worker', async () => {
    const supabaseMock = createSupabaseMock({
      pendingUpload: {
        id: 'pending-1',
        merchant_id: 'merchant-1',
        client_upload_id: 'client-upload-1',
        storage_path: 'merchant-1/orders/upload.csv',
        source_platform: 'bumpa',
        entity_type: 'orders',
        original_filename: 'orders.csv',
        content_type: 'text/csv',
        file_size_bytes: 12,
        claimed_at: null,
        expires_at: '2099-03-30T10:00:00.000Z',
      },
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const response = await POST(
      createRequest({
        clientUploadId: '11111111-1111-4111-8111-111111111111',
      }) as NextRequest
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      job: expect.objectContaining({ id: 'job-1', status: 'uploaded' }),
    });
    expect(supabaseMock.storage.from).toHaveBeenCalledWith('migration-imports');
    expect(supabaseMock.__mocks.exists).toHaveBeenCalledWith(
      'merchant-1/orders/upload.csv'
    );
    expect(supabaseMock.__mocks.insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        created_by: 'user-1',
        source_platform: 'bumpa',
        entity_type: 'orders',
        client_upload_id: 'client-upload-1',
      })
    );
    await flushAfterCallbacks();
    expect(kickoffImportJob).toHaveBeenCalledWith('job-1', 'http://localhost');
  });

  it('returns 404 when the pending upload does not exist', async () => {
    const supabaseMock = createSupabaseMock({
      pendingUpload: null,
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const response = await POST(
      createRequest({
        clientUploadId: '11111111-1111-4111-8111-111111111111',
      }) as NextRequest
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Pending upload not found',
      code: 'pending_upload_not_found',
    });
  });

  it('returns 409 when the uploaded file is missing from storage', async () => {
    const supabaseMock = createSupabaseMock({
      pendingUpload: {
        id: 'pending-1',
        merchant_id: 'merchant-1',
        client_upload_id: 'client-upload-1',
        storage_path: 'merchant-1/orders/upload.csv',
        source_platform: 'bumpa',
        entity_type: 'orders',
        original_filename: 'orders.csv',
        content_type: 'text/csv',
        file_size_bytes: 12,
        claimed_at: null,
        expires_at: '2099-03-30T10:00:00.000Z',
      },
      storageExists: false,
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const response = await POST(
      createRequest({
        clientUploadId: '11111111-1111-4111-8111-111111111111',
      }) as NextRequest
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Uploaded file is missing',
      code: 'upload_missing',
    });
  });

  it('returns 409 when direct upload is disabled', async () => {
    vi.mocked(isImportJobDirectUploadEnabled).mockReturnValue(false);
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock({}),
      } as never,
    });

    const response = await POST(
      createRequest({
        clientUploadId: '11111111-1111-4111-8111-111111111111',
      }) as NextRequest
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Direct upload is disabled',
      code: 'direct_upload_disabled',
    });
  });
});
