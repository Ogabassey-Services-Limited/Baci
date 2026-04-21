import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { resolveOrderReceiptVirtualAccount } from './resolveOrderReceiptVirtualAccount';

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
      order: {
        id: 'order-1',
        amount_paid: 10000,
        balance: 0,
        created_at: '',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: null,
        discount_amount: 0,
        order_number: 'ORD-1',
        payment_status: 'paid',
        shipping_address: null,
        shipping_status: 'pending',
        total: 10000,
        updated_at: '',
        virtual_account: {
          account_name: 'Baci',
          account_number: '1234567890',
          bank_name: 'Bank',
        },
      },
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
      order: {
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
      },
    });

    expect(account).toMatchObject({
      account_name: 'Baci Ltd',
      account_number: '0123456789',
    });
  });

  it('returns null when there is no session and no merchant fallback account', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
    });

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: null,
      order: {
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
      },
    });

    expect(account).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('returns null when session lookup rejects and there is no fallback account', async () => {
    mocks.getSession.mockRejectedValue(new Error('session failed'));

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: null,
      order: {
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
      },
    });

    expect(account).toBeNull();
  });

  it('returns null when virtual account generation returns a non-ok response without fallback data', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch.mockResolvedValue({
      ok: false,
    });

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: null,
      order: {
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
      },
    });

    expect(account).toBeNull();
  });

  it('returns null when fetch throws and there is no merchant fallback account', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch.mockRejectedValue(new Error('network failed'));

    const account = await resolveOrderReceiptVirtualAccount({
      merchant: null,
      order: {
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
      },
    });

    expect(account).toBeNull();
  });
});
