import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMigrationRowsUrl,
  createImportJob,
  fetchImportJob,
  fetchImportJobRows,
  mergeJobs,
  postImportJobAction,
} from '@/app/dashboard/migrations/migration-job-api';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
} from '@/app/dashboard/migrations/migration-types';
import { createClient } from '@/lib/supabase/client';

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn((url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (options.body && typeof options.body === 'string') {
      headers.set('content-type', 'application/json');
    }
    headers.set('x-csrf-token', 'token');

    return fetch(url, {
      ...options,
      headers: Object.fromEntries(headers.entries()),
      credentials: 'include',
    });
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

function createJsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response;
}

describe('migration-job-api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(createClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          uploadToSignedUrl: vi
            .fn()
            .mockResolvedValue({ data: {}, error: null }),
        })),
      },
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('builds rows urls with filter and paging', () => {
    expect(buildMigrationRowsUrl('job-1', 2, 'needs_fix')).toBe(
      '/api/import-jobs/job-1/rows?filter=needs_fix&page=2&pageSize=25'
    );
  });

  it('prepends new jobs and replaces existing job entries', () => {
    const olderJob = {
      id: 'job-1',
      entity_type: 'orders',
      source_platform: 'bumpa',
      status: 'uploaded',
      original_filename: 'orders.csv',
      processed_rows: 0,
      total_rows: 0,
      summary: null,
      error: null,
      created_at: '2026-03-22T10:00:00.000Z',
      committed_at: null,
      notified_at: null,
    } satisfies ImportJobListItem;
    const newerJob = {
      ...olderJob,
      status: 'preview_ready',
      processed_rows: 5,
      total_rows: 5,
    } satisfies ImportJobListItem;
    const anotherJob = {
      ...olderJob,
      id: 'job-2',
    } satisfies ImportJobListItem;

    expect(mergeJobs([olderJob, anotherJob], newerJob)).toEqual([
      newerJob,
      anotherJob,
    ]);
    expect(mergeJobs([anotherJob], newerJob)).toEqual([newerJob, anotherJob]);
  });

  it('parses payload.job when loading a job succeeds', async () => {
    const job = {
      id: 'job-1',
      entity_type: 'orders',
      source_platform: 'bumpa',
      status: 'preview_ready',
      original_filename: 'orders.csv',
      processed_rows: 10,
      total_rows: 10,
      summary: null,
      error: null,
      created_at: '2026-03-22T10:00:00.000Z',
      committed_at: null,
      notified_at: null,
      canCommit: true,
      canNotify: false,
    } satisfies ImportJobDetail;

    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({ job }));

    await expect(fetchImportJob('job-1')).resolves.toEqual(job);
  });

  it('throws when loading a job fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({ error: 'Failed to load import job' }, false)
    );

    await expect(fetchImportJob('job-1')).rejects.toThrow(
      'Failed to load import job'
    );
  });

  it('parses rows payload when loading rows succeeds', async () => {
    const rowsPayload = {
      rows: [
        {
          id: 'row-1',
          meta: {},
          normalized_payload: null,
          row_number: 1,
          row_status: 'create',
          source_external_id: 'src-1',
          source_payload: { 'Order Number': 'ORD-1001' },
          validation_errors: [],
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1 },
    } satisfies ImportJobRowsResponse;

    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse(rowsPayload));

    await expect(fetchImportJobRows('job-1', 1, 'all')).resolves.toEqual(
      rowsPayload
    );
  });

  it('throws when loading rows fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({ error: 'Failed to load import job rows' }, false)
    );

    await expect(fetchImportJobRows('job-1', 1, 'all')).rejects.toThrow(
      'Failed to load import job rows'
    );
  });

  it('initializes direct upload, uploads to signed storage, and finalizes the job', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({
          upload: {
            clientUploadId: 'client-upload-1',
            storagePath: 'merchant-1/orders/upload.csv',
            uploadToken: 'upload-token',
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse({ job: { id: 'job-1' } }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }));

    const file = new File(['id\n1'], 'orders.csv', { type: 'text/csv' });

    await createImportJob({
      entityType: 'orders',
      file,
      sourcePlatform: 'bumpa',
    });
    await postImportJobAction('/api/import-jobs/job-1/commit');

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/import-jobs/upload-init',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-csrf-token': 'token',
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/import-jobs/finalize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-csrf-token': 'token',
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/import-jobs/job-1/commit',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-csrf-token': 'token' },
      })
    );
  });

  it('falls back to multipart upload when direct upload is explicitly disabled', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            error: 'Direct upload is disabled',
            code: 'direct_upload_disabled',
          },
          false
        )
      )
      .mockResolvedValueOnce(createJsonResponse({ job: { id: 'job-1' } }));

    const file = new File(['id\n1'], 'orders.csv', { type: 'text/csv' });

    await createImportJob({
      entityType: 'orders',
      file,
      sourcePlatform: 'bumpa',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/import-jobs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-csrf-token': 'token' },
        body: expect.any(FormData),
      })
    );
  });

  it('throws when direct upload initialization fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({ error: 'Upload failed' }, false)
    );

    const file = new File(['id\n1'], 'orders.csv', { type: 'text/csv' });

    await expect(
      createImportJob({
        entityType: 'orders',
        file,
        sourcePlatform: 'bumpa',
      })
    ).rejects.toThrow('Upload failed');
  });

  it('throws when uploading to the signed storage target fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({
        upload: {
          clientUploadId: 'client-upload-1',
          storagePath: 'merchant-1/orders/upload.csv',
          uploadToken: 'upload-token',
        },
      })
    );
    vi.mocked(createClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          uploadToSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'signed upload failed' },
          }),
        })),
      },
    } as never);

    const file = new File(['id\n1'], 'orders.csv', { type: 'text/csv' });

    await expect(
      createImportJob({
        entityType: 'orders',
        file,
        sourcePlatform: 'bumpa',
      })
    ).rejects.toThrow('signed upload failed');
  });

  it('throws when queueing a job action fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({ error: 'Queue failed' }, false)
    );

    await expect(
      postImportJobAction('/api/import-jobs/job-1/commit')
    ).rejects.toThrow('Queue failed');
  });
});
