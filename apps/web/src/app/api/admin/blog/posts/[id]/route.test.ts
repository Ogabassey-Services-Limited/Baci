import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlatformAdminAuth = vi.fn();
const mockCreateClient = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockRevalidatePlatformBlog = vi.fn();

vi.mock('@/lib/platform-admin-auth', () => ({
  getPlatformAdminAuth: (...args: unknown[]) =>
    mockGetPlatformAdminAuth(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidatePlatformBlog: (...args: unknown[]) =>
    mockRevalidatePlatformBlog(...args),
}));

const mockSupabase = {
  delete: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
};

mockSupabase.from.mockReturnValue(mockSupabase);
mockSupabase.select.mockReturnValue(mockSupabase);
mockSupabase.eq.mockReturnValue(mockSupabase);
mockSupabase.is.mockReturnValue(mockSupabase);
mockSupabase.update.mockReturnValue(mockSupabase);
mockSupabase.delete.mockReturnValue(mockSupabase);

import { DELETE, GET, PATCH } from './route';

describe('GET /api/admin/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetPlatformAdminAuth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@baci.com', id: 'user-1' },
    });
    mockSupabase.single.mockResolvedValue({
      data: { id: 'post-1', slug: 'launch-faster', title: 'Launch Faster' },
      error: null,
    });
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({
      status: 'unauthenticated',
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1'),
      {
        params: Promise.resolve({ id: 'post-1' }),
      }
    );

    expect(response.status).toBe(401);
  });

  it('returns 403 for non-platform admins', async () => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({ status: 'forbidden' });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1'),
      {
        params: Promise.resolve({ id: 'post-1' }),
      }
    );

    expect(response.status).toBe(403);
  });

  it('fetches platform post by id and tenant-null scope', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1'),
      {
        params: Promise.resolve({ id: 'post-1' }),
      }
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'post-1');
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_platform_post', true);
    expect(mockSupabase.is).toHaveBeenCalledWith('merchant_id', null);
  });
});

describe('PATCH /api/admin/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetPlatformAdminAuth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@baci.com', id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockSupabase.single.mockResolvedValue({
      data: { id: 'post-1', slug: 'launch-faster', title: 'Launch Faster' },
      error: null,
    });
  });

  it('checks auth before csrf on write requests', async () => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({
      status: 'unauthenticated',
    });

    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1', {
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns csrf failure response when invalid', async () => {
    mockCheckCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json({ error: 'CSRF failed' }, { status: 403 }),
    });

    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1', {
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(response.status).toBe(403);
  });

  it('forces platform fields and revalidates after update', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1', {
        body: JSON.stringify({
          is_platform_post: false,
          merchant_id: 'merchant-1',
          slug: 'launch-faster',
          title: 'Launch Faster',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_platform_post: true,
        merchant_id: null,
      })
    );
    expect(mockRevalidatePlatformBlog).toHaveBeenCalledWith('launch-faster');
  });

  it('sets published_at when promoting a draft without requiring content in the patch payload', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: {
          id: 'post-1',
          slug: 'launch-faster',
          status: 'draft',
          featured_image_url:
            'https://cdn.example.com/storage/v1/object/public/media/platform/blog/cover.png',
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9:
              'https://cdn.example.com/storage/v1/object/public/media/platform/blog/upload-1/landscape_16x9.webp',
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'post-1',
          slug: 'launch-faster',
          status: 'published',
        },
        error: null,
      });

    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1', {
        body: JSON.stringify({
          status: 'published',
          title: 'Launch Faster',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_platform_post: true,
        merchant_id: null,
        published_at: expect.any(String),
        status: 'published',
      })
    );
  });

  it('clears stale image metadata when featured_image_url changes without replacement variants', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: {
          id: 'post-1',
          slug: 'launch-faster',
          status: 'draft',
          featured_image_url: 'https://cdn.example.com/old-cover.png',
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: 'https://cdn.example.com/old-landscape.webp',
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'post-1',
          slug: 'launch-faster',
          status: 'draft',
          featured_image_url: 'https://cdn.example.com/new-cover.png',
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
        error: null,
      });

    const response = await PATCH(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1', {
        body: JSON.stringify({
          featured_image_url: 'https://cdn.example.com/new-cover.png',
          title: 'Launch Faster',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        featured_image_url: 'https://cdn.example.com/new-cover.png',
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
        is_platform_post: true,
        merchant_id: null,
      })
    );
  });
});

describe('DELETE /api/admin/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetPlatformAdminAuth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@baci.com', id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockSupabase.single.mockResolvedValue({
      data: { id: 'post-1', slug: 'launch-faster', title: 'Launch Faster' },
      error: null,
    });
  });

  it('deletes platform post and revalidates using existing slug', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/blog/posts/post-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'post-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockRevalidatePlatformBlog).toHaveBeenCalledWith('launch-faster');
  });
});
