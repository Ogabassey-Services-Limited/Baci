import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithCsrfMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: fetchWithCsrfMock,
}));

import {
  createOrderWalletFundingIntent,
  createWalletFundingAccount,
  getOrderWalletFundingIntent,
  WalletOrderFundingIntentError,
} from '@/lib/order-wallet-funding-intent-client';

const ORDER_ID = '00000000-0000-4000-8000-000000000101';
const INTENT_ID = '00000000-0000-4000-8000-000000000102';

const ACCOUNT = {
  accountName: 'Ada Buyer',
  accountNumber: '1234567890',
  bankName: 'Wema Bank',
  provider: 'paystack',
};

const INTENT = {
  currency: 'NGN',
  expectedAmount: 5000,
  expiresAt: '2026-07-13T10:30:00.000Z',
  fundedAmount: 0,
  id: INTENT_ID,
  orderId: ORDER_ID,
  status: 'pending',
  targetOrderAmount: 5000,
};

function jsonResponse(body: unknown, status = 200) {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

describe('order wallet funding intent client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchWithCsrfMock.mockReset();
  });

  it('creates an intent and returns the parsed account + intent', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      jsonResponse({ account: ACCOUNT, intent: INTENT })
    );

    const result = await createOrderWalletFundingIntent({
      merchantId: 'merchant-1',
      merchantSlug: 'test-store',
      orderId: ORDER_ID,
    });

    expect(result.account.accountNumber).toBe('1234567890');
    expect(result.intent.status).toBe('pending');
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/storefront/customer/wallet/order-funding-intents',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('surfaces the API fallback code so the caller can retry with consent', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      jsonResponse(
        { code: 'WALLET_DVA_CONSENT_REQUIRED', error: 'Consent required' },
        409
      )
    );

    await expect(
      createOrderWalletFundingIntent({
        merchantId: 'merchant-1',
        orderId: ORDER_ID,
      })
    ).rejects.toMatchObject({
      code: 'WALLET_DVA_CONSENT_REQUIRED',
      status: 409,
    });
  });

  it('maps a transport failure onto the synthetic `network` code', async () => {
    fetchWithCsrfMock.mockRejectedValue(new Error('offline'));

    await expect(
      createOrderWalletFundingIntent({
        merchantId: 'merchant-1',
        orderId: ORDER_ID,
      })
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects a create response that does not match the schema', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      jsonResponse({ account: ACCOUNT, intent: { ...INTENT, status: 'weird' } })
    );

    await expect(
      createOrderWalletFundingIntent({
        merchantId: 'merchant-1',
        orderId: ORDER_ID,
      })
    ).rejects.toBeInstanceOf(WalletOrderFundingIntentError);
  });

  it('polls an intent through a plain credentialed GET', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        intent: { ...INTENT, orderPaid: true, status: 'completed' },
      })
    );

    const intent = await getOrderWalletFundingIntent({
      intentId: INTENT_ID,
      merchantSlug: 'test-store',
    });

    expect(intent.status).toBe('completed');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `/api/storefront/customer/wallet/order-funding-intents/${INTENT_ID}?merchantSlug=test-store`
    );
  });

  it('raises a 404 poll as an error rather than a silent null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: 'Intent not found' }, 404)
    );

    await expect(
      getOrderWalletFundingIntent({
        intentId: INTENT_ID,
        merchantSlug: 'test-store',
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('provisions the wallet funding account with explicit consent', async () => {
    fetchWithCsrfMock.mockResolvedValue(jsonResponse({ account: ACCOUNT }));

    const account = await createWalletFundingAccount({
      merchantSlug: 'test-store',
    });

    expect(account.accountNumber).toBe('1234567890');
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/storefront/customer/wallet/funding-account',
      expect.objectContaining({
        body: JSON.stringify({ consent: true, merchantSlug: 'test-store' }),
        method: 'POST',
      })
    );
  });

  it('surfaces the alias-conflict code from the funding-account API', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      jsonResponse(
        {
          code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
          error: 'Order payment in progress',
        },
        409
      )
    );

    await expect(
      createWalletFundingAccount({ merchantSlug: 'test-store' })
    ).rejects.toMatchObject({ code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT' });
  });
});
