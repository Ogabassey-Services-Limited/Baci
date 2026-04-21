import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { resolveOrderReceiptVirtualAccount } from './resolveOrderReceiptVirtualAccount';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.com',
}));

function makeOrder(
  overrides: Partial<OrderDetailsRecord> = {}
): OrderDetailsRecord {
  return {
    id: 'order-1',
    amount_paid: 0,
    balance: 10000,
    created_at: '',
    customer_email: 'customer@example.com',
    customer_name: 'Ada',
    customer_phone: null,
    discount_amount: 0,
    order_number: 'ORD-1',
    payment_status: 'pending',
    shipping_address: null,
    shipping_status: 'pending',
    total: 10000,
    updated_at: '',
    ...overrides,
  };
}

describe('resolveOrderReceiptVirtualAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the existing virtual account for paid orders', async () => {
    const account = await resolveOrderReceiptVirtualAccount({
      merchant: null,
      order: makeOrder({
        amount_paid: 10000,
        balance: 0,
        payment_status: 'paid',
        virtual_account: {
          account_name: 'Baci',
          account_number: '1234567890',
          bank_name: 'Bank',
        },
      }),
    });

    expect(account).toEqual({
      account_name: 'Baci',
      account_number: '1234567890',
      bank_name: 'Bank',
    });
  });

  it('falls back to the merchant bank account when no virtual account exists', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch.mockResolvedValue({
      json: async () => ({ account_name: 'Baci Ltd' }),
      ok: true,
    });

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: {
        bank_account_name: '',
        bank_account_number: '0123456789',
        bank_code: '044',
        business_name: 'Baci',
      },
      order: makeOrder(),
    });

    expect(account).toMatchObject({
      account_name: 'Baci Ltd',
      account_number: '0123456789',
    });
  });

  it('returns null when there is no session or fallback account available', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    expect(
      await resolveOrderReceiptVirtualAccount({
        merchant: null,
        order: makeOrder(),
      })
    ).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();

    mocks.getSession.mockRejectedValue(new Error('session failed'));
    expect(
      await resolveOrderReceiptVirtualAccount({
        merchant: null,
        order: makeOrder(),
      })
    ).toBeNull();
  });

  it('returns null when generation fails and no merchant fallback exists', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch.mockResolvedValue({ ok: false });

    expect(
      await resolveOrderReceiptVirtualAccount({
        merchant: null,
        order: makeOrder(),
      })
    ).toBeNull();

    mocks.fetch.mockRejectedValue(new Error('network failed'));
    expect(
      await resolveOrderReceiptVirtualAccount({
        merchant: null,
        order: makeOrder(),
      })
    ).toBeNull();
  });

  it('ignores a virtual account without an account number and retries generation', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch.mockResolvedValue({
      json: async () => ({
        virtualAccount: {
          account_name: 'Generated Account',
          account_number: '1234567890',
          bank_name: 'Generated Bank',
        },
      }),
      ok: true,
    });

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: null,
      order: makeOrder({
        virtual_account: {
          account_name: 'Broken',
          account_number: '',
          bank_name: 'Broken Bank',
        },
      }),
    });

    expect(account).toEqual({
      account_name: 'Generated Account',
      account_number: '1234567890',
      bank_name: 'Generated Bank',
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores a staff terminal without an account number and falls back to the merchant account', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        json: async () => ({ account_name: 'Baci Ltd' }),
        ok: true,
      });

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: {
        bank_account_name: '',
        bank_account_number: '0123456789',
        bank_code: '044',
        business_name: 'Baci',
      },
      order: makeOrder({
        staff_terminal: {
          account_name: 'Broken Terminal',
          account_number: '',
          bank_name: 'Broken Bank',
        },
      }),
    });

    expect(account).toMatchObject({
      account_name: 'Baci Ltd',
      account_number: '0123456789',
    });
  });

  it('ignores malformed API payloads and falls back to the merchant account', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch
      .mockResolvedValueOnce({
        json: async () => ({ virtualAccount: [] }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({ terminals: {} }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({ account_name: 'Baci Ltd' }),
        ok: true,
      });

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: {
        bank_account_name: '',
        bank_account_number: '0123456789',
        bank_code: '044',
        business_name: 'Baci',
      },
      order: makeOrder(),
    });

    expect(account).toMatchObject({
      account_name: 'Baci Ltd',
      account_number: '0123456789',
    });
  });
});
