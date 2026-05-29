import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrderWalletFundingIntent } from '@/lib/order-wallet-funding-intents';
import {
  createRepository,
  customer,
  merchant,
  order,
} from '@/lib/order-wallet-funding-intents.test-utils';

describe('createOrderWalletFundingIntent guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not insert when savings already cover the order residual', async () => {
    const repository = createRepository({
      getSavingsRedeemedAmount: vi.fn(async () => 20_000),
    });

    const result = await createOrderWalletFundingIntent({
      customer,
      merchant,
      orderId: 'order-1',
      repository,
      now: new Date('2026-05-26T12:00:00.000Z'),
    });

    expect(result).toEqual({ code: 'ORDER_NOT_PAYABLE', kind: 'fallback' });
    expect(repository.insertOrderWalletFundingIntent).not.toHaveBeenCalled();
  });

  it('blocks the flow when either wallet DVA or order auto-debit is disabled', async () => {
    const repository = createRepository({
      getPaymentSettings: vi.fn(async () => ({
        paystackEnabled: true,
        walletOrderAutoDebitEnabled: false,
        walletPaystackDvaEnabled: true,
      })),
    });

    const result = await createOrderWalletFundingIntent({
      customer,
      merchant,
      orderId: 'order-1',
      repository,
      now: new Date('2026-05-26T12:00:00.000Z'),
    });

    expect(result).toEqual({
      code: 'WALLET_ORDER_AUTO_DEBIT_DISABLED',
      kind: 'fallback',
    });
  });

  it('blocks the flow when wallet DVA funding is disabled', async () => {
    const repository = createRepository({
      getPaymentSettings: vi.fn(async () => ({
        paystackEnabled: true,
        walletOrderAutoDebitEnabled: true,
        walletPaystackDvaEnabled: false,
      })),
    });

    const result = await createOrderWalletFundingIntent({
      customer,
      merchant,
      orderId: 'order-1',
      repository,
      now: new Date('2026-05-26T12:00:00.000Z'),
    });

    expect(result).toEqual({
      code: 'WALLET_DVA_DISABLED',
      kind: 'fallback',
    });
  });

  it('leaves creation idempotency derivation to the database RPC', async () => {
    const repository = createRepository();

    await createOrderWalletFundingIntent({
      customer,
      merchant,
      orderId: 'order-1',
      repository,
      now: new Date('2026-05-26T12:00:00.000Z'),
    });

    const payload = vi.mocked(repository.insertOrderWalletFundingIntent).mock
      .calls[0]?.[0];
    expect(payload).toEqual(expect.objectContaining({ orderId: 'order-1' }));
    expect(payload && 'idempotencyKey' in payload).toBe(false);
  });

  it('defaults a blank order currency to NGN when creating the intent', async () => {
    const repository = createRepository({
      getOrderForCustomer: vi.fn(async () => ({ ...order, currency: ' ' })),
    });

    await createOrderWalletFundingIntent({
      customer,
      merchant,
      orderId: 'order-1',
      repository,
      now: new Date('2026-05-26T12:00:00.000Z'),
    });

    expect(repository.insertOrderWalletFundingIntent).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'NGN' })
    );
  });
});
