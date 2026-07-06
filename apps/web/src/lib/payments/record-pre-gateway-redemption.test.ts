import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  inFilter: vi.fn(),
  result: vi.fn<() => { error: { message: string } | null }>(() => ({
    error: null,
  })),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.update = mocks.update.mockReturnValue(chain);
    chain.eq = mocks.eq.mockReturnValue(chain);
    chain.in = mocks.inFilter.mockReturnValue(chain);
    // Supabase query builders are thenable; resolve with the configured
    // outcome no matter which filter method is awaited last.
    // biome-ignore lint/suspicious/noThenProperty: intentionally thenable to mirror the Supabase builder
    chain.then = (resolve: (value: unknown) => void) => resolve(mocks.result());
    return chain;
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mocks.loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { recordPreGatewayRedemption } from './record-pre-gateway-redemption';

describe('recordPreGatewayRedemption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.result.mockReturnValue({ error: null });
  });

  it('writes amount_paid and wallet_amount_used for a wallet redemption', async () => {
    await recordPreGatewayRedemption('order-1', 50000, 0, 20000);

    expect(mocks.update).toHaveBeenCalledWith({
      amount_paid: 20000,
      wallet_amount_used: 20000,
    });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'order-1');
  });

  it('only applies while the order is unpaid with no recorded payment', async () => {
    await recordPreGatewayRedemption('order-1', 50000, 0, 20000);

    expect(mocks.inFilter).toHaveBeenCalledWith('payment_status', [
      'unpaid',
      'pending',
    ]);
    expect(mocks.eq).toHaveBeenCalledWith('amount_paid', 0);
  });

  it('sums savings and wallet into amount_paid', async () => {
    await recordPreGatewayRedemption('order-1', 50000, 5000, 20000);

    expect(mocks.update).toHaveBeenCalledWith({
      amount_paid: 25000,
      wallet_amount_used: 20000,
    });
  });

  it('records savings-only redemptions without touching wallet_amount_used', async () => {
    await recordPreGatewayRedemption('order-1', 50000, 5000, 0);

    expect(mocks.update).toHaveBeenCalledWith({ amount_paid: 5000 });
  });

  it('clamps redemption amounts to the order total', async () => {
    await recordPreGatewayRedemption('order-1', 10000, 5000, 20000);

    expect(mocks.update).toHaveBeenCalledWith({
      amount_paid: 10000,
      wallet_amount_used: 10000,
    });
  });

  it('does nothing when no redemption occurred', async () => {
    await recordPreGatewayRedemption('order-1', 50000, 0, 0);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('logs but does not throw when the order update fails', async () => {
    mocks.result.mockReturnValue({ error: { message: 'db down' } });

    await expect(
      recordPreGatewayRedemption('order-1', 50000, 0, 20000)
    ).resolves.toBeUndefined();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to record pre-gateway redemption on order',
        orderId: 'order-1',
      })
    );
  });
});
