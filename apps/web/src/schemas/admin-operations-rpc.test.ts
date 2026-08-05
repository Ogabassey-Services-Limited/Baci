import { describe, expect, it } from 'vitest';
import {
  adminOperationsApiSchema,
  adminOperationsRpcSchema,
} from './admin-operations-rpc';

function payload() {
  return {
    financial: {
      paymentSideEffects: [],
      payouts: [],
      reconciliationReview: [],
      settlements: [],
    },
    generatedAt: '2026-08-05T15:02:00.000Z',
    notifications: { email: [], orderOutbox: [], push: [], trackingOutbox: [] },
    shipping: { shipments: [], webhooks: [] },
    summary: {
      notifications: 0,
      paymentSideEffects: 0,
      payouts: 0,
      reconciliationReview: 0,
      settlements: 0,
      shipping: 0,
      workers: 0,
    },
    workers: [],
  };
}

describe('adminOperationsRpcSchema', () => {
  it('accepts the redacted empty operations envelope', () => {
    expect(adminOperationsRpcSchema.safeParse(payload()).success).toBe(true);
  });

  it('requires explicit privileged capabilities on API responses', () => {
    expect(
      adminOperationsApiSchema.safeParse({
        ...payload(),
        capabilities: { canReadFinancials: false, canReplay: false },
      }).success
    ).toBe(true);
    expect(adminOperationsApiSchema.safeParse(payload()).success).toBe(false);
  });

  it('rejects a raw error field instead of treating it as an operational item', () => {
    const result = payload();
    result.shipping.webhooks.push({
      createdAt: null,
      error: 'customer@example.com',
      eventType: null,
      id: 'webhook-1',
      processed: false,
      provider: 'gigl',
      shipmentId: null,
    } as never);

    expect(adminOperationsRpcSchema.safeParse(result).success).toBe(false);
  });

  it('rejects a hostile provider error code in the browser DTO', () => {
    const result = payload();
    result.notifications.email.push({
      attemptCount: 1,
      createdAt: '2026-08-05T15:02:00.000Z',
      emailType: 'order_confirmation',
      id: 'email-1',
      merchantId: 'merchant-1',
      merchantName: 'Merchant',
      provider: 'zeptomail',
      providerErrorCode: 'recipient@example.com: request failed',
    } as never);

    expect(adminOperationsRpcSchema.safeParse(result).success).toBe(false);
  });
});
