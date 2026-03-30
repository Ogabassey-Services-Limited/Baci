import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  resolveImportRouteContext: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-service', () => ({
  createImportStoragePath: vi.fn(),
  validateImportFileMetadata: vi.fn(),
}));

import type { NextRequest as ActualNextRequest } from 'next/server';
import { isImportJobDirectUploadEnabled } from '@/env';
import { checkCsrfProtection } from '@/lib/csrf';
import { resolveImportRouteContext } from '@/lib/import-jobs/import-job-route-auth';
import {
  createImportStoragePath,
  validateImportFileMetadata,
} from '@/lib/import-jobs/import-job-service';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';

function createRequest(body: object) {
  return {
    nextUrl: new URL('http://localhost/api/import-jobs/upload-init'),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as ActualNextRequest;
}

function createSupabaseMock() {
  const createSignedUploadUrl = vi.fn().mockResolvedValue({
    data: {
      path: 'merchant-1/orders/upload.csv',
      token: 'upload-token',
      signedUrl: 'https://signed.example/upload',
    },
    error: null,
  });
  const pendingUploadsInsertQuery = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  pendingUploadsInsertQuery.insert.mockReturnValue(pendingUploadsInsertQuery);
  pendingUploadsInsertQuery.select.mockReturnValue(pendingUploadsInsertQuery);
  pendingUploadsInsertQuery.single.mockResolvedValue({
    data: {
      id: 'pending-1',
      client_upload_id: 'client-upload-1',
      storage_path: 'merchant-1/orders/upload.csv',
      expires_at: '2026-03-31T10:00:00.000Z',
    },
    error: null,
  });

  return {
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl,
      })),
    },
    from: vi.fn(() => pendingUploadsInsertQuery),
    __mocks: {
      createSignedUploadUrl,
      pendingUploadsInsertQuery,
    },
  };
}

describe('POST /api/import-jobs/upload-init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isImportJobDirectUploadEnabled).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(createImportStoragePath).mockReturnValue(
      'merchant-1/orders/upload.csv'
    );
    vi.mocked(validateImportFileMetadata).mockReturnValue(null);
  });

  it('returns 409 when direct upload is disabled', async () => {
    vi.mocked(isImportJobDirectUploadEnabled).mockReturnValue(false);
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock(),
      } as never,
    });

    const response = await POST(
      createRequest({
        sourcePlatform: 'bumpa',
        entityType: 'orders',
        fileName: 'orders.csv',
        fileSizeBytes: 12,
        contentType: 'text/csv',
      }) as NextRequest
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Direct upload is disabled',
      code: 'direct_upload_disabled',
    });
  });

  it('returns 400 when file metadata validation fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: createSupabaseMock(),
      } as never,
    });
    vi.mocked(validateImportFileMetadata).mockReturnValue(
      'Unsupported CSV content type'
    );

    const response = await POST(
      createRequest({
        sourcePlatform: 'bumpa',
        entityType: 'orders',
        fileName: 'orders.csv',
        fileSizeBytes: 12,
        contentType: 'application/json',
      }) as NextRequest
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported CSV content type',
      code: 'invalid_file',
    });
  });

  it('creates a signed upload target and pending upload record', async () => {
    const supabaseMock = createSupabaseMock();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      'client-upload-1'
    );
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: {
        userId: 'user-1',
        merchantContext: { merchantId: 'merchant-1' },
        supabase: supabaseMock,
      } as never,
    });

    const response = await POST(
      createRequest({
        sourcePlatform: 'bumpa',
        entityType: 'orders',
        fileName: 'orders.csv',
        fileSizeBytes: 12,
        contentType: 'text/csv',
      }) as NextRequest
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      upload: expect.objectContaining({
        clientUploadId: 'client-upload-1',
        storagePath: 'merchant-1/orders/upload.csv',
        uploadToken: 'upload-token',
      }),
    });
    expect(supabaseMock.storage.from).toHaveBeenCalledWith('migration-imports');
    expect(supabaseMock.__mocks.createSignedUploadUrl).toHaveBeenCalledWith(
      'merchant-1/orders/upload.csv',
      { upsert: false }
    );
    expect(supabaseMock.from).toHaveBeenCalledWith('pending_import_uploads');
    expect(
      supabaseMock.__mocks.pendingUploadsInsertQuery.insert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        created_by: 'user-1',
        client_upload_id: 'client-upload-1',
        storage_path: 'merchant-1/orders/upload.csv',
        source_platform: 'bumpa',
        entity_type: 'orders',
        original_filename: 'orders.csv',
        file_size_bytes: 12,
        content_type: 'text/csv',
      })
    );
  });
});
