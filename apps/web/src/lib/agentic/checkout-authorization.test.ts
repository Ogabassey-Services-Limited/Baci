import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCheckoutCompletionAuthorization } from '@/lib/agentic/checkout-authorization';

const secret = 'test-agentic-confirmation-secret';
const now = new Date('2026-04-28T12:00:00.000Z');

function sign(payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function humanPayload({
  amount,
  confirmedAt,
  currency = 'NGN',
  sessionId = 'session-1',
}: {
  amount: number;
  confirmedAt: string;
  currency?: string;
  sessionId?: string;
}) {
  return JSON.stringify({
    amount,
    confirmed_at: confirmedAt,
    currency: currency.toUpperCase(),
    session_id: sessionId,
    type: 'human_confirmation',
  });
}

function mandatePayload({
  currency = 'NGN',
  expiresAt,
  mandateId = 'mandate-1',
  maxAmount,
  sessionId = 'session-1',
}: {
  currency?: string;
  expiresAt: string;
  mandateId?: string;
  maxAmount: number;
  sessionId?: string;
}) {
  return JSON.stringify({
    currency: currency.toUpperCase(),
    expires_at: expiresAt,
    mandate_id: mandateId,
    max_amount: maxAmount,
    session_id: sessionId,
    type: 'payment_mandate',
  });
}

function humanAuthorization(params: {
  amount: number;
  confirmedAt: string;
  currency?: string;
  sessionId?: string;
}) {
  return {
    amount: params.amount,
    confirmed_at: params.confirmedAt,
    currency: params.currency ?? 'NGN',
    session_id: params.sessionId ?? 'session-1',
    signature: sign(humanPayload(params)),
    type: 'human_confirmation' as const,
  };
}

function mandateAuthorization(params: {
  currency?: string;
  expiresAt: string;
  mandateId?: string;
  maxAmount: number;
  sessionId?: string;
}) {
  return {
    currency: params.currency ?? 'NGN',
    expires_at: params.expiresAt,
    mandate_id: params.mandateId ?? 'mandate-1',
    max_amount: params.maxAmount,
    session_id: params.sessionId ?? 'session-1',
    signature: sign(mandatePayload(params)),
    type: 'payment_mandate' as const,
  };
}

describe('verifyCheckoutCompletionAuthorization', () => {
  it('accepts an exact human confirmation artifact', () => {
    const confirmedAt = '2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: humanAuthorization({ amount: 2500, confirmedAt }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: true, mode: 'human_confirmation' });
  });

  it('rejects confirmation artifacts for a different amount', () => {
    const confirmedAt = '2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: humanAuthorization({ amount: 3000, confirmedAt }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'CONFIRMATION_MISMATCH' });
  });

  it('compares authorization amounts using normalized minor units', () => {
    const confirmedAt = '2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500.004,
        authorization: humanAuthorization({ amount: 2500, confirmedAt }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: true, mode: 'human_confirmation' });
  });

  it('rejects non-finite requested amounts', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: Number.NaN,
        authorization: null,
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_INVALID' });
  });

  it('rejects empty currencies before authorization comparison', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: mandateAuthorization({
          expiresAt: '2026-04-28T13:00:00.000Z',
          maxAmount: 5000,
        }),
        currency: ' ',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_INVALID' });
  });

  it('normalizes payment mandate amount comparisons', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500.004,
        authorization: mandateAuthorization({
          expiresAt: '2026-04-28T13:00:00.000Z',
          maxAmount: 2500,
        }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: true, mode: 'payment_mandate' });
  });

  it('rejects payment mandates below the normalized requested amount', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500.01,
        authorization: mandateAuthorization({
          expiresAt: '2026-04-28T13:00:00.000Z',
          maxAmount: 2500,
        }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'CONFIRMATION_MISMATCH' });
  });

  it('accepts a mandate only when amount and currency are inside limits', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: mandateAuthorization({
          expiresAt: '2026-04-28T13:00:00.000Z',
          maxAmount: 5000,
        }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: true, mode: 'payment_mandate' });
  });

  it('rejects future-dated human confirmation artifacts', () => {
    const confirmedAt = '2026-04-28T12:02:00.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: humanAuthorization({ amount: 2500, confirmedAt }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_EXPIRED' });
  });

  it('returns SERVER_CONFIGURATION_ERROR when no signing secrets are configured', () => {
    const confirmedAt = '2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: humanAuthorization({ amount: 2500, confirmedAt }),
        currency: 'NGN',
        now,
        secrets: [],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'SERVER_CONFIGURATION_ERROR' });
  });

  it('rejects negative authorization amounts', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: -1,
        authorization: mandateAuthorization({
          expiresAt: '2026-04-28T13:00:00.000Z',
          maxAmount: 5000,
        }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_INVALID' });
  });

  it('fails closed when authorization is missing or expired', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: null,
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'CONFIRMATION_REQUIRED' });

    expect(
      verifyCheckoutCompletionAuthorization({
        amount: 2500,
        authorization: mandateAuthorization({
          expiresAt: '2026-04-28T11:00:00.000Z',
          maxAmount: 5000,
        }),
        currency: 'NGN',
        now,
        secrets: [secret],
        sessionId: 'session-1',
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_EXPIRED' });
  });
});
