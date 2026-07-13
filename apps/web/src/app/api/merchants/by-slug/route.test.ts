import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

const mockUnstableCache = vi.fn(
  (callback: () => Promise<unknown>, ..._args: unknown[]) => callback
);
vi.mock('next/cache', () => ({
  unstable_cache: (callback: () => Promise<unknown>, ...args: unknown[]) =>
    mockUnstableCache(callback, ...args),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

import { GET } from './route';

describe('GET /api/merchants/by-slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: {
        id: 'merchant-1',
        business_name: 'Test Store',
        slug: 'test-store',
        is_published: true,
      },
      error: null,
    });
  });

  it('keeps publication state out of browser and shared HTTP caches', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/merchants/by-slug?slug=test-store'
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'private, no-store, max-age=0, must-revalidate'
    );
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(mockUnstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['merchant-by-slug', 'test-store'],
      {
        revalidate: 300,
        tags: ['merchant', 'merchant-slug-test-store'],
      }
    );
  });

  it('returns 400 when the slug query parameter is missing', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/merchants/by-slug')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Slug is required',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 404 when Supabase reports that the merchant does not exist', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/merchants/by-slug?slug=missing-store'
      )
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Merchant not found',
    });
  });

  it('returns 500 when the Supabase lookup fails', async () => {
    const error = { code: 'PGRST000', message: 'Database unavailable' };
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSingle.mockResolvedValue({ data: null, error });

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/merchants/by-slug?slug=test-store'
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Error fetching merchant by slug:',
      error
    );
    errorSpy.mockRestore();
  });
});
