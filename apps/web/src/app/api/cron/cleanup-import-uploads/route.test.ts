import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: vi.fn(() => 'cron-secret'),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from '@/lib/supabase/service';
import { GET } from './route';

function createCronRequest(authorization?: string) {
  return new NextRequest(
    'http://localhost:3000/api/cron/cleanup-import-uploads',
    {
      headers: authorization ? { authorization } : {},
    }
  );
}

function createSupabaseMock() {
  const expiredUploadsQuery = {
    select: vi.fn(),
    is: vi.fn(),
    lt: vi.fn(),
  };
  expiredUploadsQuery.select.mockReturnValue(expiredUploadsQuery);
  expiredUploadsQuery.is.mockReturnValue(expiredUploadsQuery);
  expiredUploadsQuery.lt.mockResolvedValue({
    data: [
      {
        id: 'pending-1',
        storage_path: 'merchant-1/orders/upload.csv',
      },
    ],
    error: null,
  });

  const deleteQuery = {
    delete: vi.fn(),
    eq: vi.fn(),
  };
  deleteQuery.delete.mockReturnValue(deleteQuery);
  deleteQuery.eq.mockResolvedValue({ error: null });

  const existingJobQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  existingJobQuery.select.mockReturnValue(existingJobQuery);
  existingJobQuery.eq.mockReturnValue(existingJobQuery);
  existingJobQuery.maybeSingle.mockResolvedValue({
    data: null,
    error: null,
  });

  const exists = vi.fn().mockResolvedValue({ data: true, error: null });
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });

  let pendingUploadsCallCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'pending_import_uploads') {
        pendingUploadsCallCount += 1;
        return pendingUploadsCallCount === 1
          ? expiredUploadsQuery
          : deleteQuery;
      }

      if (table === 'import_jobs') {
        return existingJobQuery;
      }

      return deleteQuery;
    }),
    storage: {
      from: vi.fn(() => ({
        exists,
        remove,
      })),
    },
    __mocks: {
      deleteQuery,
      exists,
      expiredUploadsQuery,
      existingJobQuery,
      remove,
    },
  };
}

describe('GET /api/cron/cleanup-import-uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await GET(createCronRequest());

    expect(response.status).toBe(401);
  });

  it('removes expired unclaimed uploads and deletes their tracking rows', async () => {
    const supabaseMock = createSupabaseMock();
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as never);

    const response = await GET(createCronRequest('Bearer cron-secret'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cleaned: 1 });
    expect(supabaseMock.storage.from).toHaveBeenCalledWith('migration-imports');
    expect(supabaseMock.__mocks.exists).toHaveBeenCalledWith(
      'merchant-1/orders/upload.csv'
    );
    expect(supabaseMock.__mocks.remove).toHaveBeenCalledWith([
      'merchant-1/orders/upload.csv',
    ]);
  });
});
