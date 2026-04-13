import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe('GET /api/storefront/features', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockCreateClient.mockReset();

    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockCreateClient.mockReturnValue({ from: mockFrom });
  });

  it('reads search params from nextUrl without touching request.url', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        reviews_enabled: true,
        wishlist_enabled: true,
      },
      error: null,
    });

    const request = {
      nextUrl: new URL(
        'https://example.com/api/storefront/features?merchantId=merchant-1'
      ),
      get url() {
        throw new Error('request.url should not be read');
      },
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as { reviewsEnabled: boolean };

    expect(response.status).toBe(200);
    expect(body.reviewsEnabled).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('merchant_feature_settings');
  });

  it('returns 400 when neither merchantId nor slug is provided', async () => {
    const request = {
      nextUrl: new URL('https://example.com/api/storefront/features'),
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('merchantId or slug is required');
  });
});
