import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  createClient: vi.fn(),
  generateHeroImageBatch: vi.fn(),
  getPlatformAdminAuth: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/lib/platform-admin-auth', () => {
  return {
    getPlatformAdminAuth: mocks.getPlatformAdminAuth,
  };
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/services/hero-image-generator', () => ({
  generateHeroImageBatch: mocks.generateHeroImageBatch,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from './route';

describe('/api/admin/generate-hero-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getPlatformAdminAuth.mockResolvedValue({ status: 'unauthenticated' });
    mocks.eq.mockResolvedValue({ data: [], error: null });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.createClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: mocks.select,
      }),
    });
    mocks.generateHeroImageBatch.mockResolvedValue({
      success: true,
      imageIds: ['hero-1', 'hero-2'],
    });
  });

  it('GET should return 401 when unauthenticated', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('GET should return 403 when user is not a platform admin', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({ status: 'forbidden' });

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it('GET should return hero image statistics for platform admins', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
    });
    mocks.eq.mockResolvedValueOnce({
      data: [
        { category: 'electronics', usage_count: 2 },
        { category: 'electronics', usage_count: 6 },
        { category: 'fashion', usage_count: 1 },
      ],
      error: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      statistics: {
        electronics: { total: 2, avgUsage: 4, totalUsage: 8 },
        fashion: { total: 1, avgUsage: 1, totalUsage: 1 },
      },
      totalImages: 3,
    });
  });

  it('GET should log stats query failures without exposing raw database errors', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
    });
    mocks.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation ai_hero_images does not exist' },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to retrieve hero image statistics',
    });
    expect(body.error).not.toContain('relation');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hero image stats query failed',
        error: { message: 'relation ai_hero_images does not exist' },
      })
    );
  });

  it('POST should return 401 when unauthenticated', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'electronics' }),
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('POST should return 403 when user is not a platform admin', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({ status: 'forbidden' });
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'electronics' }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('POST should reject invalid request payloads before generation', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
    });
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'phones', count: 50 }),
      }
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid request payload');
    expect(mocks.generateHeroImageBatch).not.toHaveBeenCalled();
  });

  it('POST should reject non-object JSON payloads without throwing', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
    });
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      {
        method: 'POST',
        body: 'null',
      }
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid request payload');
    expect(mocks.generateHeroImageBatch).not.toHaveBeenCalled();
  });

  it('POST should reject malformed JSON payloads without throwing', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
    });
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      {
        method: 'POST',
        body: '{"category":',
      }
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid request payload');
    expect(mocks.generateHeroImageBatch).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid hero image generation JSON payload',
      })
    );
  });

  it('POST should generate hero images for platform admins', async () => {
    mocks.getPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
    });
    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate-hero-images',
      {
        method: 'POST',
        body: JSON.stringify({ category: 'electronics', count: 2 }),
      }
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.generateHeroImageBatch).toHaveBeenCalledWith('electronics', 2);
    expect(body).toEqual({
      success: true,
      imageIds: ['hero-1', 'hero-2'],
      count: 2,
      message: 'Successfully generated 2 hero images for electronics',
    });
  });
});
