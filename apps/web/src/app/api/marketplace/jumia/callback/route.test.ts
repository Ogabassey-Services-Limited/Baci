import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantIdForApiUser = vi.fn();
const mockExchangeJumiaCode = vi.fn();
const mockGetShops = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
const mockUpsert = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    upsert: (...args: unknown[]) => {
      mockUpsert(...args);
      return Promise.resolve({ error: null });
    },
  })),
};

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getMerchantIdForApiUser: (...args: unknown[]) =>
    mockGetMerchantIdForApiUser(...args),
}));

vi.mock('@/lib/jumia/helpers', () => ({
  exchangeJumiaCode: (...args: unknown[]) => mockExchangeJumiaCode(...args),
}));

vi.mock('@/lib/jumia/client', () => ({
  JumiaClient: class {
    getShops() {
      return mockGetShops();
    }
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

vi.mock('@/env', () => ({
  getAppUrl: vi.fn(
    () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/'
  ),
  getJumiaClientId: vi.fn(() => process.env.JUMIA_CLIENT_ID),
  getJumiaClientSecret: vi.fn(() => process.env.JUMIA_CLIENT_SECRET),
}));

import { GET } from './route';

describe('Jumia callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000/';
    process.env.JUMIA_CLIENT_ID = 'test-client-id';
    process.env.JUMIA_CLIENT_SECRET = 'test-client-secret';
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: mockSupabase,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(
      '00000000-0000-0000-0000-000000000001'
    );
    mockExchangeJumiaCode.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    mockGetShops.mockResolvedValue([
      {
        id: 'shop-1',
        name: 'Jumia Shop',
        email: 'shop@example.com',
        businessClients: [
          {
            name: 'Jumia Nigeria',
            code: 'jumia_ng',
            countryCode: 'NG',
            countryName: 'Nigeria',
            status: 'active',
            shortCode: 'NG',
          },
        ],
      },
    ]);
  });

  it('exchanges the code using the validated app callback URL', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/marketplace/jumia/callback?code=auth-code&state=test-state',
      {
        headers: {
          cookie: [
            'jumia_oauth_state=test-state',
            'jumia_merchant_id=00000000-0000-0000-0000-000000000001',
          ].join('; '),
        },
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: '00000000-0000-0000-0000-000000000001',
        platform: 'jumia',
        shop_id: 'shop-1',
        shop_name: 'Jumia Shop',
        access_token: 'access',
        refresh_token: 'refresh',
        is_active: true,
        sync_config: expect.objectContaining({
          products: true,
          orders: true,
          stock: true,
        }),
      }),
      expect.objectContaining({
        onConflict: 'merchant_id,platform,shop_id',
      })
    );
    expect(mockExchangeJumiaCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'auth-code',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/api/marketplace/jumia/callback',
      })
    );
  });
});
