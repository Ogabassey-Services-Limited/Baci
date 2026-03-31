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

vi.mock('@/lib/csrf', () => ({
  buildCsrfHeaders: vi.fn(() => ({ 'x-csrf-token': 'token' })),
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

  it('posts upload and action requests with csrf headers', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse({ job: { id: 'job-1' } }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }));

    const formData = new FormData();
    formData.set('file', new Blob(['id\n1']), 'orders.csv');

    await createImportJob(formData);
    await postImportJobAction('/api/import-jobs/job-1/commit');

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/import-jobs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-csrf-token': 'token' },
        body: formData,
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/import-jobs/job-1/commit',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-csrf-token': 'token' },
      })
    );
  });

  it('throws when upload creation fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({ error: 'Upload failed' }, false)
    );

    const formData = new FormData();
    formData.set('file', new Blob(['id\n1']), 'orders.csv');

    await expect(createImportJob(formData)).rejects.toThrow('Upload failed');
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
