import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseMock,
  makeUploadRequest,
  mockAuthenticatedRequest,
  mockAuthorizedMerchant,
  mockCheckCsrfProtection,
  mockCheckRateLimit,
} from './route.test-support';

const { POST } = await import('./post');

describe('upload blog image POST handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorizedMerchant();
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it('returns a stable upload failure when inline storage rejects a valid file', async () => {
    const { supabase, upload } = createSupabaseMock();
    upload.mockResolvedValue({ error: { message: 'bucket unavailable' } });
    mockAuthenticatedRequest(supabase);

    const response = await POST(
      makeUploadRequest({
        file: new File(['photo'], 'post.gif', { type: 'image/gif' }),
        purpose: 'inline',
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'UPLOAD_FAILED',
      error: 'Failed to upload file',
    });
  });

  it('rejects an oversized file before handing it to storage', async () => {
    const { supabase } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const largeFile = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'huge.png',
      {
        type: 'image/png',
      }
    );

    const response = await POST(
      makeUploadRequest({ file: largeFile, purpose: 'inline' })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'File too large. Maximum size is 5MB',
    });
  });
});
