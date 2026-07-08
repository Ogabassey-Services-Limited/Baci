import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDecryptedMerchantCredential } from '@/lib/payments/merchant-credentials';
import { createAdminClient } from '@/lib/supabase/admin';
import { POST } from './route';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/payments/merchant-credentials', () => ({
  getDecryptedMerchantCredential: vi.fn(),
  markMerchantCredentialInvalid: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

function createRequest(bodyOverrides: Record<string, unknown> = {}) {
  return new NextRequest(
    'https://example.com/api/payments/paypal/client-token',
    {
      method: 'POST',
      body: JSON.stringify({ merchant_id: MERCHANT_ID, ...bodyOverrides }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function buildSupabaseMock(
  settings: { data: unknown; error: unknown } = {
    data: {
      custom_settings: { paypal_enabled: true, paypal_mode: 'sandbox' },
    },
    error: null,
  }
) {
  const mock = {
    from: vi.fn(() => mock),
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    single: vi.fn(() => Promise.resolve(settings)),
  };
  return mock;
}

describe('POST /api/payments/paypal/client-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when merchant_id is missing', async () => {
    const response = await POST(
      new NextRequest('https://example.com', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('merchant_id is required');
  });

  it('returns 404 when merchant settings are not found', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        data: null,
        error: { message: 'not found' },
      }) as never
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('Merchant settings not found');
  });

  it('returns 400 when PayPal is not enabled', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        data: { custom_settings: { paypal_enabled: false } },
        error: null,
      }) as never
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      'PayPal is not configured or enabled for this merchant'
    );
  });

  it('returns 400 when the vault has no client id', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    vi.mocked(getDecryptedMerchantCredential).mockRejectedValue(
      new Error('missing client_id')
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_NOT_CONFIGURED');
  });

  it('returns the vault client id and mode when configured', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    vi.mocked(getDecryptedMerchantCredential).mockResolvedValue(
      'vault-client-id'
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clientId: 'vault-client-id',
      mode: 'sandbox',
    });
  });
});
