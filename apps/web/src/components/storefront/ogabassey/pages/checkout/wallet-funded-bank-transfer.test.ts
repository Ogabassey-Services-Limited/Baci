import { beforeEach, describe, expect, it, vi } from 'vitest';

const createIntentMock = vi.hoisted(() => vi.fn());
const createAccountMock = vi.hoisted(() => vi.fn());
const captureClientEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/order-wallet-funding-intent-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/order-wallet-funding-intent-client')
  >('@/lib/order-wallet-funding-intent-client');
  return {
    createOrderWalletFundingIntent: createIntentMock,
    createWalletFundingAccount: createAccountMock,
    WalletOrderFundingIntentError: actual.WalletOrderFundingIntentError,
  };
});

vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: captureClientEventMock,
}));

import { WalletOrderFundingIntentError } from '@/lib/order-wallet-funding-intent-client';
import {
  startWalletFundedBankTransfer,
  WALLET_CONSENT_DENIED,
} from './wallet-funded-bank-transfer';

const CREATED = {
  account: {
    accountName: 'Ada Buyer',
    accountNumber: '1234567890',
    bankName: 'Wema Bank',
    provider: 'paystack' as const,
  },
  intent: {
    currency: 'NGN',
    expectedAmount: 5000,
    expiresAt: '2026-07-13T10:30:00.000Z',
    fundedAmount: 0,
    id: 'intent-1',
    orderId: 'order-1',
    status: 'pending' as const,
    targetOrderAmount: 5000,
  },
};

const ARGS = {
  merchantId: 'merchant-1',
  merchantSlug: 'test-store',
  orderId: 'order-1',
};

describe('startWalletFundedBankTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the intent and reports it when creation succeeds first try', async () => {
    createIntentMock.mockResolvedValue(CREATED);

    const result = await startWalletFundedBankTransfer({
      ...ARGS,
      requestConsent: vi.fn(),
    });

    expect(result).toEqual({ kind: 'intent', ...CREATED });
    expect(createAccountMock).not.toHaveBeenCalled();
    expect(captureClientEventMock).toHaveBeenCalledWith(
      'wallet_order_funding_intent_created',
      expect.objectContaining({ intent_id: 'intent-1', with_consent: false })
    );
  });

  it('asks for consent, provisions the wallet account, and retries once', async () => {
    createIntentMock
      .mockRejectedValueOnce(
        new WalletOrderFundingIntentError(
          'Consent required',
          'WALLET_DVA_CONSENT_REQUIRED',
          409
        )
      )
      .mockResolvedValueOnce(CREATED);
    createAccountMock.mockResolvedValue(CREATED.account);

    const result = await startWalletFundedBankTransfer({
      ...ARGS,
      requestConsent: vi.fn().mockResolvedValue(true),
    });

    expect(result).toMatchObject({ kind: 'intent' });
    expect(createAccountMock).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      merchantSlug: 'test-store',
    });
    expect(captureClientEventMock).toHaveBeenCalledWith(
      'wallet_order_funding_intent_created',
      expect.objectContaining({ with_consent: true })
    );
  });

  it('falls back when a non-enabled merchant declines the intent', async () => {
    createIntentMock.mockRejectedValue(
      new WalletOrderFundingIntentError(
        'Auto debit disabled',
        'WALLET_ORDER_AUTO_DEBIT_DISABLED',
        403
      )
    );
    const requestConsent = vi.fn();

    const result = await startWalletFundedBankTransfer({
      ...ARGS,
      requestConsent,
    });

    expect(result).toMatchObject({
      code: 'WALLET_ORDER_AUTO_DEBIT_DISABLED',
      kind: 'fallback',
    });
    expect(requestConsent).not.toHaveBeenCalled();
    expect(captureClientEventMock).toHaveBeenCalledWith(
      'wallet_order_funding_fallback',
      expect.objectContaining({ reason: 'WALLET_ORDER_AUTO_DEBIT_DISABLED' })
    );
  });

  it('falls back for a guest checkout', async () => {
    createIntentMock.mockRejectedValue(
      new WalletOrderFundingIntentError(
        'Customer not found',
        'GUEST_CHECKOUT',
        409
      )
    );

    await expect(
      startWalletFundedBankTransfer({ ...ARGS, requestConsent: vi.fn() })
    ).resolves.toMatchObject({ code: 'GUEST_CHECKOUT', kind: 'fallback' });
  });

  it('falls back when the customer declines consent', async () => {
    createIntentMock.mockRejectedValue(
      new WalletOrderFundingIntentError(
        'Consent required',
        'WALLET_DVA_CONSENT_REQUIRED',
        409
      )
    );

    const result = await startWalletFundedBankTransfer({
      ...ARGS,
      requestConsent: vi.fn().mockResolvedValue(false),
    });

    expect(result).toMatchObject({
      code: WALLET_CONSENT_DENIED,
      kind: 'fallback',
    });
    expect(createAccountMock).not.toHaveBeenCalled();
  });

  it('falls back when wallet-account provisioning fails after consent', async () => {
    createIntentMock.mockRejectedValue(
      new WalletOrderFundingIntentError(
        'Consent required',
        'WALLET_DVA_CONSENT_REQUIRED',
        409
      )
    );
    createAccountMock.mockRejectedValue(
      new WalletOrderFundingIntentError(
        'Order payment in progress',
        'WALLET_DVA_ORDER_ALIAS_CONFLICT',
        409
      )
    );

    await expect(
      startWalletFundedBankTransfer({
        ...ARGS,
        requestConsent: vi.fn().mockResolvedValue(true),
      })
    ).resolves.toMatchObject({
      code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
      kind: 'fallback',
    });
  });

  it('never throws — a transport failure becomes a fallback', async () => {
    createIntentMock.mockRejectedValue(new Error('offline'));

    await expect(
      startWalletFundedBankTransfer({ ...ARGS, requestConsent: vi.fn() })
    ).resolves.toMatchObject({ kind: 'fallback' });
  });
});
