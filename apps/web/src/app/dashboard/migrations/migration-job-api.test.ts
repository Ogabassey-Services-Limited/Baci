import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tusMock = vi.hoisted(() => ({
  instances: [] as Array<{
    findPreviousUploads: ReturnType<typeof vi.fn>;
    options: {
      chunkSize?: number;
      endpoint?: string | null;
      headers?: Record<string, string>;
      metadata?: Record<string, string>;
      onProgress?: (bytesSent: number, bytesTotal: number) => void;
      onSuccess?: () => void;
    };
    resumeFromPreviousUpload: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('tus-js-client', () => ({
  isSupported: true,
  Upload: class MockUpload {
    findPreviousUploads = vi.fn().mockResolvedValue([]);
    resumeFromPreviousUpload = vi.fn();
    start = vi.fn(() => {
      this.options.onProgress?.(3, 6);
      this.options.onSuccess?.();
    });

    constructor(
      _file: File,
      public options: {
        chunkSize?: number;
        endpoint?: string | null;
        headers?: Record<string, string>;
        metadata?: Record<string, string>;
        onProgress?: (bytesSent: number, bytesTotal: number) => void;
        onSuccess?: () => void;
      }
    ) {
      tusMock.instances.push(this);
    }
  },
}));

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
import { MIGRATION_IMPORT_BUCKET } from '@/lib/import-jobs/import-job-storage';
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
    tusMock.instances = [];
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'session-access-token' } },
          error: null,
        }),
      },
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
    vi.unstubAllEnvs();
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

  it('initializes authenticated TUS upload, reports progress, and finalizes the job', async () => {
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
    const onUploadProgress = vi.fn();

    await createImportJob({
      entityType: 'orders',
      file,
      onUploadProgress,
      sourcePlatform: 'bumpa',
    });
    await postImportJobAction('/api/import-jobs/job-1/commit');

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(tusMock.instances).toHaveLength(1);
    expect(tusMock.instances[0]?.options).toMatchObject({
      chunkSize: 6 * 1024 * 1024,
      endpoint: 'https://mock.storage.supabase.co/storage/v1/upload/resumable',
      headers: {
        apikey: 'mock-anon-key',
        authorization: 'Bearer session-access-token',
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: MIGRATION_IMPORT_BUCKET,
        objectName: 'merchant-1/orders/upload.csv',
        contentType: 'text/csv',
        cacheControl: '3600',
      },
    });
    expect(onUploadProgress).toHaveBeenCalledWith({
      bytesUploaded: 0,
      bytesTotal: file.size,
      percent: 0,
      stage: 'initializing',
    });
    expect(onUploadProgress).toHaveBeenCalledWith({
      bytesUploaded: 3,
      bytesTotal: 6,
      percent: 50,
      stage: 'uploading',
    });
    expect(onUploadProgress).toHaveBeenCalledWith({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percent: 100,
      stage: 'finalizing',
    });
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

  it('uses signed URL upload when TUS is unsupported', async () => {
    vi.resetModules();
    vi.doMock('tus-js-client', () => ({
      isSupported: false,
      Upload: class UnsupportedTusUpload {
        constructor() {
          throw new Error('TUS upload should not be constructed');
        }
      },
    }));

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
      .mockResolvedValueOnce(createJsonResponse({ job: { id: 'job-1' } }));

    const mockUploadToSignedUrl = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });
    const mockStorageFrom = vi.fn(() => ({
      uploadToSignedUrl: mockUploadToSignedUrl,
    }));
    vi.mocked(createClient).mockReturnValue({
      storage: {
        from: mockStorageFrom,
      },
    } as never);

    const { createImportJob: createImportJobWithSignedUrlFallback } =
      await import('@/app/dashboard/migrations/migration-job-api');
    const file = new File(['id\n1'], 'orders.csv', { type: 'text/csv' });
    const onUploadProgress = vi.fn();

    await createImportJobWithSignedUrlFallback({
      entityType: 'orders',
      file,
      onUploadProgress,
      sourcePlatform: 'bumpa',
    });

    expect(mockStorageFrom).toHaveBeenCalledWith(MIGRATION_IMPORT_BUCKET);
    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(
      'merchant-1/orders/upload.csv',
      'upload-token',
      file,
      {
        contentType: 'text/csv',
        upsert: false,
      }
    );
    expect(onUploadProgress).toHaveBeenCalledWith({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percent: 100,
      stage: 'uploading',
    });
    expect(onUploadProgress).toHaveBeenCalledWith({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percent: 100,
      stage: 'finalizing',
    });
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

  it('throws when the authenticated TUS upload target fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({
        upload: {
          clientUploadId: 'client-upload-1',
          storagePath: 'merchant-1/orders/upload.csv',
          uploadToken: 'upload-token',
        },
      })
    );
    const uploadError = new Error('signed upload failed');
    tusMock.instances.push = vi.fn((instance) => {
      instance.start.mockImplementationOnce(() => {
        instance.options.onProgress?.(1, 2);
        throw uploadError;
      });
      return 1;
    });

    const file = new File(['id\n1'], 'orders.csv', { type: 'text/csv' });

    await expect(
      createImportJob({
        entityType: 'orders',
        file,
        sourcePlatform: 'bumpa',
      })
    ).rejects.toThrow(uploadError);
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
