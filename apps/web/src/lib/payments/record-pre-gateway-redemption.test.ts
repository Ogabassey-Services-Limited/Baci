import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const chain = {
      from: vi.fn(),
      update: mocks.update,
      eq: mocks.eq,
    };
    chain.from.mockReturnValue(chain);
    mocks.update.mockReturnValue(chain);
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
    mocks.eq.mockResolvedValue({ error: null });
  });

  it('writes amount_paid and wallet_amount_used for a wallet redemption', async () => {
    await recordPreGatewayRedemption('order-1', 0, 20000);

    expect(mocks.update).toHaveBeenCalledWith({
      amount_paid: 20000,
      wallet_amount_used: 20000,
    });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'order-1');
  });

  it('sums savings and wallet into amount_paid', async () => {
    await recordPreGatewayRedemption('order-1', 5000, 20000);

    expect(mocks.update).toHaveBeenCalledWith({
      amount_paid: 25000,
      wallet_amount_used: 20000,
    });
  });

  it('records savings-only redemptions without touching wallet_amount_used', async () => {
    await recordPreGatewayRedemption('order-1', 5000, 0);

    expect(mocks.update).toHaveBeenCalledWith({ amount_paid: 5000 });
  });

  it('does nothing when no redemption occurred', async () => {
    await recordPreGatewayRedemption('order-1', 0, 0);

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('logs but does not throw when the order update fails', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'db down' } });

    await expect(
      recordPreGatewayRedemption('order-1', 0, 20000)
    ).resolves.toBeUndefined();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to record pre-gateway redemption on order',
        orderId: 'order-1',
      })
    );
  });
});
