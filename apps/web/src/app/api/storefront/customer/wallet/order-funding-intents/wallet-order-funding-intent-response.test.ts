import { describe, expect, it } from 'vitest';
import { CUSTOMER_NAME_REQUIRED_MESSAGE } from '@/lib/customer-wallet-payment-account-types';
import { formatIntentResult } from './wallet-order-funding-intent-response';

describe('wallet order funding intent responses', () => {
  it('returns an actionable 400 when customer names are missing', async () => {
    const response = formatIntentResult({
      code: 'CUSTOMER_NAME_REQUIRED',
      kind: 'fallback',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'CUSTOMER_NAME_REQUIRED',
      error: CUSTOMER_NAME_REQUIRED_MESSAGE,
      kind: 'fallback',
    });
  });
});
