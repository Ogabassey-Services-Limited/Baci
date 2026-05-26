import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateSessionId,
  getPrivateKey,
  getPublicKey,
  isAmountEligible,
  isLiveMode,
  signTransaction,
} from '@/lib/credit-direct';
import { createClient } from '@/lib/supabase/server';
import { POST } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/credit-direct', () => ({
  CREDIT_DIRECT_CONFIG: {
    maxAmount: 5_000_000,
    minAmount: 10_000,
  },
  generateSessionId: vi.fn(),
  getPrivateKey: vi.fn(),
  getPublicKey: vi.fn(),
  isAmountEligible: vi.fn(),
  isLiveMode: vi.fn(),
  signTransaction: vi.fn(),
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ORDER_ID = '123e4567-e89b-12d3-a456-426614174111';

type RpcResult = { data: unknown; error: unknown };
type SettingsRow = {
  credit_direct_enabled: boolean;
  credit_direct_max_amount: number;
  credit_direct_min_amount: number;
  credit_direct_public_key: string;
  merchant_id: string;
};
type OrderSnapshotRow = {
  merchant_id: string;
  total: number;
};

function buildSettingsRow(overrides: Partial<SettingsRow> = {}): SettingsRow {
  return {
    credit_direct_enabled: true,
    credit_direct_max_amount: 500_000,
    credit_direct_min_amount: 10_000,
    credit_direct_public_key: 'db-public-key',
    merchant_id: MERCHANT_ID,
    ...overrides,
  };
}

function buildOrderSnapshotRow(
  overrides: Partial<OrderSnapshotRow> = {}
): OrderSnapshotRow {
  return {
    merchant_id: MERCHANT_ID,
    total: 120_000,
    ...overrides,
  };
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest(
    'https://example.com/api/payments/credit-direct/sign',
    {
      method: 'POST',
      body: JSON.stringify({
        customerEmail: 'customer@example.com',
        merchantSlug: 'ogabassey',
        orderId: ORDER_ID,
        totalAmount: 120_000,
        ...overrides,
      }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function buildSupabaseMock(overrides: Partial<Record<string, RpcResult>> = {}) {
  const defaultResults: Record<string, RpcResult> = {
    get_credit_direct_settings: {
      data: [buildSettingsRow()],
      error: null,
    },
    get_order_payment_snapshot: {
      data: [buildOrderSnapshotRow()],
      error: null,
    },
    set_credit_direct_session: {
      data: true,
      error: null,
    },
    ...overrides,
  };

  return {
    rpc: vi.fn((name: string) =>
      Promise.resolve(defaultResults[name] ?? { data: null, error: null })
    ),
  };
}

describe('POST /api/payments/credit-direct/sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn() } as never);
    vi.mocked(generateSessionId).mockReturnValue('session-123');
    vi.mocked(getPrivateKey).mockReturnValue('env-private-key');
    vi.mocked(getPublicKey).mockReturnValue('env-public-key');
    vi.mocked(isAmountEligible).mockReturnValue(true);
    vi.mocked(isLiveMode).mockReturnValue(true);
    vi.mocked(signTransaction).mockReturnValue('signed-transaction');
    vi.mocked(createClient).mockReturnValue(buildSupabaseMock() as never);
  });

  it.each([
    {
      expectedField: 'customerEmail',
      overrides: { customerEmail: 'not-an-email' },
    },
    {
      expectedField: 'merchantSlug',
      overrides: { merchantSlug: '' },
    },
    {
      expectedField: 'orderId',
      overrides: { orderId: 'not-a-uuid' },
    },
    {
      expectedField: 'totalAmount',
      overrides: { totalAmount: '1e3' },
    },
  ])('returns 400 before signing for invalid $expectedField', async ({
    expectedField,
    overrides,
  }) => {
    const response = await POST(createRequest(overrides));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
    expect(body.details[expectedField]).toBeDefined();
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('returns 400 before signing when amount exceeds the verified order total', async () => {
    vi.mocked(createClient).mockReturnValue(
      buildSupabaseMock({
        get_order_payment_snapshot: {
          data: [buildOrderSnapshotRow({ total: 119_999 })],
          error: null,
        },
      }) as never
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Amount exceeds order total' });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 before signing when the merchant is not found', async () => {
    vi.mocked(createClient).mockReturnValue(
      buildSupabaseMock({
        get_credit_direct_settings: { data: [], error: null },
      }) as never
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Merchant not found' });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 before signing when Credit Direct is disabled', async () => {
    vi.mocked(createClient).mockReturnValue(
      buildSupabaseMock({
        get_credit_direct_settings: {
          data: [buildSettingsRow({ credit_direct_enabled: false })],
          error: null,
        },
      }) as never
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: 'Credit Direct BNPL is not enabled for this merchant',
    });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 before signing when the order is not found', async () => {
    vi.mocked(createClient).mockReturnValue(
      buildSupabaseMock({
        get_order_payment_snapshot: { data: [], error: null },
      }) as never
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Order not found or email mismatch' });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 before signing when the order belongs to another merchant', async () => {
    vi.mocked(createClient).mockReturnValue(
      buildSupabaseMock({
        get_order_payment_snapshot: {
          data: [
            buildOrderSnapshotRow({
              merchant_id: '123e4567-e89b-12d3-a456-426614174999',
            }),
          ],
          error: null,
        },
      }) as never
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Merchant mismatch for this order' });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('returns 500 when the signed session cannot be linked', async () => {
    vi.mocked(createClient).mockReturnValue(
      buildSupabaseMock({
        set_credit_direct_session: {
          data: null,
          error: { message: 'rpc failed' },
        },
      }) as never
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to initialize Credit Direct checkout',
    });
    expect(signTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not combine an environment private key with a merchant public key', async () => {
    vi.mocked(getPublicKey).mockImplementation(() => {
      throw new Error(
        'CREDIT_DIRECT_PUBLIC_KEY environment variable is not set'
      );
    });
    const supabase = buildSupabaseMock();
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Credit Direct public key not configured' });
    expect(signTransaction).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'set_credit_direct_session',
      expect.anything()
    );
  });

  it('signs with the matching environment key pair', async () => {
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(signTransaction).toHaveBeenCalledWith(
      'session-123',
      'customer@example.com',
      120_000,
      'env-private-key'
    );
    expect(body).toEqual({
      isLive: true,
      publicKey: 'env-public-key',
      sessionId: 'session-123',
      signature: 'signed-transaction',
    });
  });

  it('accepts numeric-string amounts from storefront order lookups', async () => {
    const response = await POST(createRequest({ totalAmount: '120000.00' }));

    expect(response.status).toBe(200);
    expect(signTransaction).toHaveBeenCalledWith(
      'session-123',
      'customer@example.com',
      120_000,
      'env-private-key'
    );
  });
});
