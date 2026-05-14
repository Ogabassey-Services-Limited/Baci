import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGenerateFeaturedImageVariants = vi.fn();
const mockIsManagedBlogStoragePath = vi.fn();

class MockBlogFeaturedImageError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BlogFeaturedImageError';
    this.code = code;
  }
}

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/blog-featured-image-variants', () => ({
  BlogFeaturedImageError: MockBlogFeaturedImageError,
  generateFeaturedImageVariants: (...args: unknown[]) =>
    mockGenerateFeaturedImageVariants(...args),
  isManagedBlogStoragePath: (...args: unknown[]) =>
    mockIsManagedBlogStoragePath(...args),
}));

const routeModule = await import('./route');
const { POST, DELETE } = routeModule;

const ownerAccess = {
  merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
  isOwner: true,
  isStaff: false,
  role: 'owner',
  permissions: { '*': { '*': true } },
};

function makeUploadRequest(input: {
  file?: File;
  purpose?: 'featured' | 'inline';
}): NextRequest {
  const formData = new FormData();
  if (input.file) {
    formData.append('file', input.file);
  }
  if (input.purpose) {
    formData.append('purpose', input.purpose);
  }

  return {
    headers: new Headers({ host: 'localhost:3000' }),
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

function makeDeleteRequest(body: unknown): NextRequest {
  return {
    headers: new Headers({ host: 'localhost:3000' }),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function createSupabaseMock() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: {
      publicUrl: `https://cdn.example.com/storage/v1/object/public/media/${path}`,
    },
  }));

  const storageBucket = {
    upload,
    remove,
    getPublicUrl,
  };

  const storage = {
    from: vi.fn((bucket: string) => {
      if (bucket !== 'media') {
        throw new Error(`Unexpected bucket: ${bucket}`);
      }
      return storageBucket;
    }),
  };

  return {
    supabase: { storage },
    upload,
    remove,
    getPublicUrl,
  };
}

function mockAuthenticatedRequest(supabase: unknown) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: 'user-1' },
    error: null,
    supabase,
  });
}

describe('blog upload route segment config', () => {
  // Cache Components rejects segment-level runtime config, so route modules must not export runtime.
  it('does not export runtime because Cache Components rejects segment runtime config', () => {
    expect(routeModule).not.toHaveProperty('runtime');
  });
});

describe('POST /api/merchant/blog/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetUserAccess.mockResolvedValue(ownerAccess);
    mockHasPermission.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
    mockGenerateFeaturedImageVariants.mockResolvedValue({
      source: {
        width: 1200,
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
    expect(mockGenerateFeaturedImageVariants).not.toHaveBeenCalled();
    expect(body.path).toContain(`${ownerAccess.merchantId}/blog/`);
    expect(body.url).toContain('/media/');
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
      expect(body.variants.landscape_16x9).toContain('/landscape_16x9.webp');
      expect(body.variantPaths.landscape_16x9).toContain(
        '/landscape_16x9.webp'
      );
      expect(body.featuredImageVariants.landscape_16x9).toMatchObject({
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
      .mockResolvedValueOnce({ error: null }) // original
      .mockResolvedValueOnce({ error: null }) // first variant
      .mockResolvedValueOnce({ error: { message: 'variant upload failed' } }); // second variant

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

describe('DELETE /api/merchant/blog/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetUserAccess.mockResolvedValue(ownerAccess);
    mockHasPermission.mockReturnValue(true);
    mockIsManagedBlogStoragePath.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it('returns 401 before csrf for unauthenticated requests', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Unauthorized',
      supabase: null,
    });

    const response = await DELETE(
      makeDeleteRequest({ path: `${ownerAccess.merchantId}/blog/abc.png` })
    );

    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('supports backward-compatible delete body with { path }', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await DELETE(
      makeDeleteRequest({ path: `${ownerAccess.merchantId}/blog/abc123.png` })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(remove).toHaveBeenCalledWith([
      `${ownerAccess.merchantId}/blog/abc123.png`,
    ]);
  });

  it('returns 429 and skips storage deletion when rate limited', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockCheckRateLimit.mockResolvedValue(false);

    const response = await DELETE(
      makeDeleteRequest({ path: `${ownerAccess.merchantId}/blog/abc123.png` })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe('rate_limited');
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes deduplicated variant and primary paths in one request', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const primaryPath = `${ownerAccess.merchantId}/blog/abc123.png`;
    const variantPath = `${ownerAccess.merchantId}/blog/abc123/landscape_16x9.webp`;

    const response = await DELETE(
      makeDeleteRequest({
        path: primaryPath,
        variantPaths: {
          landscape_16x9: variantPath,
          standard_4x3: variantPath,
          square_1x1: primaryPath,
        },
      })
    );

    expect(response.status).toBe(200);
    const removedPaths = remove.mock.calls[0]?.[0] as string[];
    expect(removedPaths).toEqual([primaryPath, variantPath]);
  });

  it('rejects delete paths that fail managed-path validation', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockIsManagedBlogStoragePath.mockImplementation((path: string) =>
      path.includes('/blog/')
    );

    const response = await DELETE(
      makeDeleteRequest({
        path: '../bad/path.png',
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed delete JSON payloads', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await DELETE({
      json: vi.fn().mockRejectedValue(new Error('malformed json')),
    } as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns 400 when delete body is missing both path and variantPaths', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await DELETE(makeDeleteRequest({}));

    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns 400 when variantPaths is the wrong type', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await DELETE(
      makeDeleteRequest({
        path: `${ownerAccess.merchantId}/blog/abc123.png`,
        variantPaths: 'invalid',
      })
    );

    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });
});
