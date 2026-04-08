import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');

  return {
    ...actual,
    // Simulates Next.js after() by scheduling the callback one microtick ahead.
    // Coupled with flushAfterCallbacks() below which awaits exactly two ticks:
    // the first settles this outer promise, the second settles .then(callback).
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

vi.mock('@/lib/import-jobs/kickoff-import-job', () => ({
  startImportJob: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-route-auth', () => ({
  getImportJobForMerchant: vi.fn(),
  hasImportRoutePermission: vi.fn(),
  resolveImportRouteContext: vi.fn(),
}));

import { checkCsrfProtection } from '@/lib/csrf';
import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  type ImportRouteContext,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';
import { startImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { POST } from './route';

const jobId = '00000000-0000-4000-8000-000000000001';

// Two consecutive awaits are needed because the `after()` mock wraps the
// callback in `Promise.resolve().then(callback)`, so the first await settles
// the outer promise and the second settles the inner `.then(callback)` chain.
async function flushAfterCallbacks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createRouteContext(): ImportRouteContext {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockResolvedValue({ data: [{ id: jobId }], error: null });

  return {
    merchantContext: {
      merchantId: 'merchant-1',
    } as ImportRouteContext['merchantContext'],
    supabase: {
      from: vi.fn(() => query),
    } as unknown as ImportRouteContext['supabase'],
    userId: 'user-1',
  };
}

function makeImportJob(
  overrides?: Partial<
    Pick<ImportJobRecord, 'id' | 'entity_type' | 'status' | 'summary'>
  >
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
    total_rows: 3,
    processed_rows: 3,
    summary: overrides?.summary || { validRows: 3 },
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
    committed_at: null,
    notified_at: null,
    completed_at: null,
  };
}

describe('POST /api/import-jobs/[jobId]/commit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: createRouteContext(),
    });
    vi.mocked(hasImportRoutePermission).mockReturnValue(true);
  });

  it('returns 401 when authentication fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(401);
  });

  it('returns 403 when csrf validation fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(403);
    expect(startImportJob).not.toHaveBeenCalled();
  });

  it('returns 404 when the job does not exist', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(null);

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(404);
    expect(startImportJob).not.toHaveBeenCalled();
  });

  it('returns 403 when the merchant lacks permission for the import entity', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(makeImportJob());
    vi.mocked(hasImportRoutePermission).mockReturnValue(false);

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(403);
    expect(startImportJob).not.toHaveBeenCalled();
  });

  it('returns 409 when the job is not preview ready', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(
      makeImportJob({ status: 'uploaded' })
    );

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(409);
  });

  it('queues the commit and triggers the worker', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(makeImportJob());

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(202);
    await flushAfterCallbacks();
    expect(startImportJob).toHaveBeenCalledWith(jobId, 'http://localhost');
  });

  it('returns 202 even when post-response kickoff rejects', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(makeImportJob());
    vi.mocked(startImportJob).mockRejectedValue(new Error('boom'));
    const context = createRouteContext();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({ context });
    const query = context.supabase.from('import_jobs') as unknown as {
      update: ReturnType<typeof vi.fn>;
    };

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      jobId,
      status: 'commit_queued',
    });
    await flushAfterCallbacks();
    expect(startImportJob).toHaveBeenCalledWith(jobId, 'http://localhost');
    expect(query.update).toHaveBeenNthCalledWith(1, {
      status: 'commit_queued',
      error: null,
      error_details: null,
    });
    expect(query.update).toHaveBeenNthCalledWith(
      2,
      {
        status: 'preview_ready',
        error: 'Commit kickoff failed — please retry',
        error_details: null,
      },
      { count: 'exact' }
    );
  });

  it('returns 409 when the preview_ready transition does not update any rows', async () => {
    const context = createRouteContext();
    const query = context.supabase.from('import_jobs') as unknown as {
      select: ReturnType<typeof vi.fn>;
    };
    query.select.mockResolvedValueOnce({ data: [], error: null });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({ context });
    vi.mocked(getImportJobForMerchant).mockResolvedValue(makeImportJob());

    const response = await POST(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}/commit`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(409);
    expect(startImportJob).not.toHaveBeenCalled();
  });
});
