import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLOG_MEDIA_CDN_BASE,
  createSupabaseMock,
  MockBlogFeaturedImageError,
  makeUploadRequest,
  mockAuthenticatedRequest,
  mockAuthorizedMerchant,
  mockCheckCsrfProtection,
  mockCheckRateLimit,
  mockGenerateFeaturedImageVariants,
  ownerAccess,
  POST,
} from './route.test-support';

describe('blog upload route segment config', () => {
  it('does not export runtime because Cache Components rejects segment runtime config', async () => {
    const routeModule = await import('./route');
    expect(routeModule).not.toHaveProperty('runtime');
  });
});

describe('POST /api/merchant/blog/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthorizedMerchant();
    mockCheckRateLimit.mockResolvedValue(true);
    mockGenerateFeaturedImageVariants.mockResolvedValue({
      source: { width: 1200, height: 675, totalPixels: 810000 },
      variants: {
        landscape_16x9: {
          key: 'landscape_16x9',
          width: 1200,
          height: 675,
          contentType: 'image/webp',
          buffer: Buffer.from('landscape'),
        },
        standard_4x3: {
          key: 'standard_4x3',
          width: 900,
          height: 675,
          contentType: 'image/webp',
          buffer: Buffer.from('fourthree'),
        },
      },
    });
  });

  it('returns 401 before csrf for unauthenticated requests', async () => {
    const { mockAuthenticateApiRequest } = await import('./route.test-support');
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Unauthorized',
      supabase: null,
    });
    const response = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
      })
    );
    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('keeps inline upload compatibility and accepts GIF files', async () => {
    const { supabase, upload } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const response = await POST(
      makeUploadRequest({
        file: new File(['gif-bytes'], 'inline.gif', { type: 'image/gif' }),
        purpose: 'inline',
      })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(supabase.storage.from).toHaveBeenCalledWith('media');
    expect(mockGenerateFeaturedImageVariants).not.toHaveBeenCalled();
    expect(body.path).toContain(`${ownerAccess.merchantId}/blog/`);
    expect(body.url).toContain(
      `${BLOG_MEDIA_CDN_BASE}/${ownerAccess.merchantId}/blog/`
    );
    expect(body.url).not.toContain('/storage/v1/object/public/');
  });

  it('returns 429 and skips upload work when rate limited', async () => {
    const { supabase, upload } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockCheckRateLimit.mockResolvedValue(false);
    const response = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
        purpose: 'featured',
      })
    );
    const body = await response.json();
    expect(response.status).toBe(429);
    expect(body.code).toBe('rate_limited');
    expect(upload).not.toHaveBeenCalled();
    expect(mockGenerateFeaturedImageVariants).not.toHaveBeenCalled();
  });

  it('rejects featured uploads when helper raises a validation error', async () => {
    const { supabase, upload } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockGenerateFeaturedImageVariants.mockRejectedValue(
      new MockBlogFeaturedImageError(
        'FEATURED_IMAGE_DIMENSIONS_TOO_SMALL',
        'Featured image must be at least 1200x675.'
      )
    );
    const response = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
        purpose: 'featured',
      })
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe('FEATURED_IMAGE_DIMENSIONS_TOO_SMALL');
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns stable timeout code when featured processing times out', async () => {
    const { supabase, upload } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockGenerateFeaturedImageVariants.mockRejectedValue(
      new MockBlogFeaturedImageError(
        'FEATURED_IMAGE_PROCESSING_TIMEOUT',
        'Featured image processing timed out.'
      )
    );
    const response = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
        purpose: 'featured',
      })
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe('FEATURED_IMAGE_PROCESSING_TIMEOUT');
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads featured original and generated variants with metadata response', async () => {
    const { supabase, upload } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    try {
      const response = await POST(
        makeUploadRequest({
          file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
          purpose: 'featured',
        })
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(upload).toHaveBeenCalledTimes(3);
      expect(body.width).toBe(1200);
      expect(body.height).toBe(675);
      expect(body.url).toContain(
        `${BLOG_MEDIA_CDN_BASE}/${ownerAccess.merchantId}/blog/`
      );
      expect(body.url).not.toContain('/storage/v1/object/public/');
      expect(body.variants.landscape_16x9).toContain(
        `${BLOG_MEDIA_CDN_BASE}/${ownerAccess.merchantId}/blog/`
      );
      expect(body.variants.landscape_16x9).toContain('/landscape_16x9.webp');
      expect(body.variants.landscape_16x9).not.toContain(
        '/storage/v1/object/public/'
      );
      expect(body.variantPaths.landscape_16x9).toContain(
        '/landscape_16x9.webp'
      );
      expect(body.featuredImageVariants.landscape_16x9).toMatchObject({
        url: body.variants.landscape_16x9,
        width: 1200,
        height: 675,
        contentType: 'image/webp',
      });
      expect(body.featuredImageVariants.standard_4x3).toMatchObject({
        width: 900,
        height: 675,
        contentType: 'image/webp',
      });
      expect(infoSpy).toHaveBeenCalledWith(
        'Processed featured blog media upload',
        expect.objectContaining({
          merchantId: ownerAccess.merchantId,
          purpose: 'featured',
          sourceWidth: 1200,
          sourceHeight: 675,
          sourceTotalPixels: 810000,
          variantKeys: ['landscape_16x9', 'standard_4x3'],
          size: 11,
          type: 'image/png',
        })
      );
      expect(JSON.stringify(infoSpy.mock.calls[0]?.[1])).not.toContain(
        'image-bytes'
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  it('generates unique storage paths for repeated featured uploads with the same original filename', async () => {
    const { supabase } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const firstResponse = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
        purpose: 'featured',
      })
    );
    const secondResponse = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
        purpose: 'featured',
      })
    );
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstBody.path).not.toBe(secondBody.path);
    expect(firstBody.variantPaths.landscape_16x9).not.toBe(
      secondBody.variantPaths.landscape_16x9
    );
  });

  it('cleans up already uploaded paths when variant upload fails mid-flight', async () => {
    const { supabase, upload, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'variant upload failed' } });
    const response = await POST(
      makeUploadRequest({
        file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
        purpose: 'featured',
      })
    );
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.code).toBe('UPLOAD_FAILED');
    expect(remove).toHaveBeenCalledTimes(1);
    const removedPaths = remove.mock.calls[0]?.[0] as string[];
    expect(Array.isArray(removedPaths)).toBe(true);
    expect(removedPaths.length).toBeGreaterThan(0);
    expect(
      removedPaths.every((path) =>
        path.startsWith(`${ownerAccess.merchantId}/blog/`)
      )
    ).toBe(true);
  });
});
