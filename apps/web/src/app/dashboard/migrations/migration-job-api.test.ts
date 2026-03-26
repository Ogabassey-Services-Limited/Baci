import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMigrationRowsUrl,
  createImportJob,
  fetchImportJob,
  fetchImportJobRows,
  postImportJobAction,
} from '@/app/dashboard/migrations/migration-job-api';

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

  it('throws when loading a job fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({ error: 'Failed to load import job' }, false)
    );

    await expect(fetchImportJob('job-1')).rejects.toThrow(
      'Failed to load import job'
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
});
