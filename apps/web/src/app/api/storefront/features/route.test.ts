import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const VALID_MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
const MISSING_MERCHANT_ID = '00000000-0000-4000-8000-000000000099';

const mockSingle = vi.fn();
const mockMerchantEq = vi.fn();
const mockMerchantSelect = vi.fn();
const mockSettingsEq = vi.fn();
const mockSettingsSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

describe('GET /api/storefront/features', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockMerchantEq.mockReset();
    mockMerchantSelect.mockReset();
    mockSettingsEq.mockReset();
    mockSettingsSelect.mockReset();
    mockFrom.mockReset();
    mockCreateClient.mockReset();
    mockLoggerError.mockReset();

    mockMerchantEq.mockReturnValue({ single: mockSingle });
    mockMerchantSelect.mockReturnValue({ eq: mockMerchantEq });
    mockSettingsEq.mockReturnValue({ single: mockSingle });
    mockSettingsSelect.mockReturnValue({
      eq: mockSettingsEq,
      single: mockSingle,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return { select: mockMerchantSelect };
      }

      if (table === 'merchant_feature_settings') {
        return { select: mockSettingsSelect };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mockCreateClient.mockReturnValue({ from: mockFrom });
  });

  it('reads search params from nextUrl without touching request.url', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'merchant-1',
        paystack_subaccount_code: null,
      },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: {
        paystack_enabled: true,
        reviews_enabled: true,
        wishlist_enabled: true,
      },
      error: null,
    });

    const request = {
      nextUrl: new URL(
        `https://example.com/api/storefront/features?merchantId=${VALID_MERCHANT_ID}`
      ),
      get url() {
        throw new Error('request.url should not be read');
      },
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as {
      paystackEnabled: boolean;
      reviewsEnabled: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.paystackEnabled).toBe(false);
    expect(body.reviewsEnabled).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('merchants');
    expect(mockFrom).toHaveBeenCalledWith('merchant_feature_settings');
  });

  it('returns default features with paystack disabled when merchant has no subaccount', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'merchant-1',
        paystack_subaccount_code: null,
      },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const request = {
      nextUrl: new URL(
        `https://example.com/api/storefront/features?merchantId=${VALID_MERCHANT_ID}`
      ),
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as {
      paystackEnabled: boolean;
      reviewsEnabled: boolean;
      wishlistEnabled: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.paystackEnabled).toBe(false);
    expect(body.reviewsEnabled).toBe(true);
    expect(body.wishlistEnabled).toBe(true);
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

  it('returns 404 when the merchant does not exist', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const request = {
      nextUrl: new URL(
        `https://example.com/api/storefront/features?merchantId=${MISSING_MERCHANT_ID}`
      ),
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Store not found');
  });

  it('returns 400 when merchantId is not a valid UUID', async () => {
    const request = {
      nextUrl: new URL(
        'https://example.com/api/storefront/features?merchantId=not-a-uuid'
      ),
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid merchantId');
  });

  it('returns 500 when the merchant lookup fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: {
        code: '57014',
        message: 'statement timeout',
      },
    });

    const request = {
      nextUrl: new URL(
        `https://example.com/api/storefront/features?merchantId=${VALID_MERCHANT_ID}`
      ),
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Storefront features merchant lookup failed',
      })
    );
  });

  it('returns 500 when the feature settings lookup fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123',
      },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: {
        code: '57014',
        message: 'statement timeout',
      },
    });

    const request = {
      nextUrl: new URL(
        `https://example.com/api/storefront/features?merchantId=${VALID_MERCHANT_ID}`
      ),
    } as unknown as NextRequest;

    const response = await GET(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Storefront features settings lookup failed',
      })
    );
  });
});
