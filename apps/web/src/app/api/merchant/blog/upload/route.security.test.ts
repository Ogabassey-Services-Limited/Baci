import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE,
  makeDeleteRequest,
  makeUploadRequest,
  mockAuthenticatedRequest,
  mockCheckCsrfProtection,
  mockGetMerchantForApiRequest,
  POST,
} from './route.test-support';

describe('blog upload CSRF ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedRequest({});
    mockCheckCsrfProtection.mockResolvedValue({ valid: false, response: null });
  });

  it('rejects POST CSRF failures before resolving merchant access', async () => {
    const response = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects DELETE CSRF failures before resolving merchant access or parsing JSON', async () => {
    const request = makeDeleteRequest({ path: 'ignored' });
    const response = await DELETE(request);

    expect(response.status).toBe(403);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
    expect(request.json).not.toHaveBeenCalled();
  });
});
