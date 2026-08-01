import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseMock,
  makeUploadRequest,
  mockAuthenticatedRequest,
  mockAuthorizedMerchant,
  mockCheckCsrfProtection,
  mockCheckRateLimit,
  mockGenerateFeaturedImageVariants,
  ownerAccess,
  POST,
} from './route.test-support';

describe('bugfix: POST /api/merchant/blog/upload cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthorizedMerchant();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it('cleans uploaded featured media when an unexpected response error occurs', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockGenerateFeaturedImageVariants.mockResolvedValue({
      source: {
        get width() {
          throw new Error('unexpected response serialization failure');
        },
        height: 675,
        totalPixels: 810000,
      },
      variants: {
        landscape_16x9: {
          key: 'landscape_16x9',
          width: 1200,
          height: 675,
          contentType: 'image/webp',
          buffer: Buffer.from('landscape'),
        },
      },
    });
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const response = await POST(
        makeUploadRequest({
          file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
          purpose: 'featured',
        })
      );

      expect(response.status).toBe(500);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(remove.mock.calls[0]?.[0]).toEqual([
        expect.stringMatching(new RegExp(`^${ownerAccess.merchantId}/blog/`)),
        expect.stringMatching(
          new RegExp(
            `^${ownerAccess.merchantId}/blog/.+/landscape_16x9\\.webp$`
          )
        ),
      ]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
