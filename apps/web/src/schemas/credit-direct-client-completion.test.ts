import { describe, expect, it } from 'vitest';
import { creditDirectClientCompletionSchema } from './credit-direct-client-completion';

const ORDER_ID = '00000000-0000-4000-8000-000000000001';

describe('creditDirectClientCompletionSchema', () => {
  it('accepts a scoped Credit Direct client-completion record', () => {
    expect(
      creditDirectClientCompletionSchema.parse({
        checkoutTransactionId: '  cd-transaction-1  ',
        orderId: ORDER_ID,
        tracking_token: 'track-1',
      })
    ).toEqual({
      checkoutTransactionId: 'cd-transaction-1',
      orderId: ORDER_ID,
      tracking_token: 'track-1',
    });
  });

  it('accepts session-only evidence without mislabelling it as a transaction id', () => {
    expect(
      creditDirectClientCompletionSchema.parse({
        orderId: ORDER_ID,
        sessionId: 'session-1',
      })
    ).toEqual({ orderId: ORDER_ID, sessionId: 'session-1' });
  });

  it.each([
    { checkoutTransactionId: '', orderId: ORDER_ID },
    { checkoutTransactionId: 'cd-1', orderId: 'not-a-uuid' },
    {
      checkoutTransactionId: 'x'.repeat(201),
      orderId: ORDER_ID,
    },
    {
      checkoutTransactionId: 'cd-1',
      orderId: ORDER_ID,
      tracking_token: '',
    },
    { orderId: ORDER_ID },
  ])('rejects malformed completion evidence', (payload) => {
    expect(creditDirectClientCompletionSchema.safeParse(payload).success).toBe(
      false
    );
  });
});
