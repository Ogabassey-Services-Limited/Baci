import { describe, expect, it, vi } from 'vitest';
import { placePetrockRemediationOrder } from './petrock-remediation-order-flow';

function state() {
  return {
    begin: vi.fn().mockResolvedValue(true),
    failBeforeAcceptance: vi.fn().mockResolvedValue(true),
    finalize: vi.fn().mockResolvedValue(true),
    markSubmissionUnknown: vi.fn().mockResolvedValue(true),
    prepare: vi
      .fn()
      .mockResolvedValue({ id: 'order-1', status: 'payment_pending' }),
    recordSubmission: vi.fn().mockResolvedValue(true),
    redeem: vi.fn().mockResolvedValue(true),
  };
}

const input = {
  fxRate: 1575,
  identifier: '490154203237518',
  order: {
    amountNgn: null,
    amountUsdt: null,
    costUsd: 75,
    customerId: 'customer-1',
    id: 'order-1',
    merchantId: 'merchant-1',
    status: 'eligible' as const,
  },
  origin: 'https://ogabassey.com',
  paymentCurrency: 'NGN' as const,
  product: {
    active: true,
    catalogCostUsd: 75,
    catalogOrderFieldName: 'IMEI',
    catalogSyncedAt: new Date().toISOString(),
    curatedProductId: '22222222-2222-4222-8222-222222222222',
    orderFieldName: 'IMEI',
    providerProductId: 'unlock-product',
    priceNgn: 150_000,
    priceUsdt: 100,
  },
};

describe('placePetrockRemediationOrder', () => {
  it('preflights, captures the wallet, write-aheads, and only then submits', async () => {
    const calls: string[] = [];
    const orderState = state();
    orderState.prepare.mockImplementation(() => {
      calls.push('prepare');
      return Promise.resolve({ id: 'order-1', status: 'payment_pending' });
    });
    orderState.redeem.mockImplementation(() => {
      calls.push('redeem');
      return Promise.resolve(true);
    });
    orderState.begin.mockImplementation(() => {
      calls.push('begin');
      return Promise.resolve(true);
    });
    const submitOrder = vi.fn(() => {
      calls.push('submit');
      return Promise.resolve({
        data: { orderUuid: 'provider-order-1' },
        ok: true as const,
        rawText: '{}',
      });
    });

    const result = await placePetrockRemediationOrder({
      ...input,
      client: {
        getAccount: vi.fn().mockResolvedValue({
          data: { balance: 100, currency: 'USD' },
          ok: true,
          rawText: '{}',
        }),
        submitOrder,
      },
      state: orderState,
    });

    expect(result.kind).toBe('pending');
    expect(calls).toEqual(['prepare', 'redeem', 'begin', 'submit']);
    expect(orderState.recordSubmission).toHaveBeenCalled();
  });

  it('does not capture when reseller balance cannot cover the product', async () => {
    const orderState = state();
    const result = await placePetrockRemediationOrder({
      ...input,
      client: {
        getAccount: vi.fn().mockResolvedValue({
          data: { balance: 20, currency: 'USD' },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn(),
      },
      state: orderState,
    });

    expect(result.kind).toBe('preflight_failed');
    expect(orderState.prepare).not.toHaveBeenCalled();
    expect(orderState.redeem).not.toHaveBeenCalled();
  });

  it('resumes a prepared quote without preparing it a second time', async () => {
    const orderState = state();

    const result = await placePetrockRemediationOrder({
      ...input,
      client: {
        getAccount: vi.fn().mockResolvedValue({
          data: { balance: 100, currency: 'USD' },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn().mockResolvedValue({
          data: { orderUuid: 'provider-order-1' },
          ok: true,
          rawText: '{}',
        }),
      },
      order: {
        ...input.order,
        amountNgn: 150_000,
        status: 'payment_pending',
      },
      state: orderState,
    });

    expect(result.kind).toBe('pending');
    expect(orderState.prepare).not.toHaveBeenCalled();
    expect(orderState.redeem).toHaveBeenCalledOnce();
  });

  it('refunds a captured wallet when paid-order preflight fails', async () => {
    const orderState = state();

    const result = await placePetrockRemediationOrder({
      ...input,
      client: {
        getAccount: vi.fn().mockResolvedValue({
          data: { balance: 20, currency: 'USD' },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn(),
      },
      order: { ...input.order, status: 'paid' },
      state: orderState,
    });

    expect(result.kind).toBe('preflight_failed');
    expect(orderState.failBeforeAcceptance).toHaveBeenCalledWith({
      customerMessage:
        'This unlock could not be submitted, so your wallet was refunded.',
      orderId: 'order-1',
      reason: 'provider_preflight_failed',
    });
  });

  it('rejects a quote that no longer covers provider cost at the current FX rate', async () => {
    const orderState = state();

    const result = await placePetrockRemediationOrder({
      ...input,
      product: { ...input.product, priceNgn: 100_000 },
      state: orderState,
      client: {
        getAccount: vi.fn().mockResolvedValue({
          data: { balance: 100, currency: 'USD' },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn(),
      },
    });

    expect(result.kind).toBe('preflight_failed');
    expect(orderState.prepare).not.toHaveBeenCalled();
    expect(orderState.redeem).not.toHaveBeenCalled();
  });

  it('refunds a paid NGN quote that became loss-making before submission', async () => {
    const orderState = state();

    const result = await placePetrockRemediationOrder({
      ...input,
      order: {
        ...input.order,
        amountNgn: 100_000,
        status: 'paid',
      },
      state: orderState,
      client: {
        getAccount: vi.fn().mockResolvedValue({
          data: { balance: 100, currency: 'USD' },
          ok: true,
          rawText: '{}',
        }),
        submitOrder: vi.fn(),
      },
    });

    expect(result.kind).toBe('preflight_failed');
    expect(orderState.failBeforeAcceptance).toHaveBeenCalled();
    expect(orderState.begin).not.toHaveBeenCalled();
  });

  it('fails closed for a future-dated provider catalog snapshot', async () => {
    const orderState = state();
    const getAccount = vi.fn();

    const result = await placePetrockRemediationOrder({
      ...input,
      client: { getAccount, submitOrder: vi.fn() },
      product: {
        ...input.product,
        catalogSyncedAt: new Date(Date.now() + 60_000).toISOString(),
      },
      state: orderState,
    });

    expect(result.kind).toBe('preflight_failed');
    expect(orderState.prepare).not.toHaveBeenCalled();
    expect(getAccount).not.toHaveBeenCalled();
  });
});
