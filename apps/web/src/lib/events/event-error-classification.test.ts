import { describe, expect, it } from 'vitest';
import { classifyDeliveryFailure } from './event-error-classification';

describe('classifyDeliveryFailure', () => {
  it('retries throttling and server responses', () => {
    expect(
      classifyDeliveryFailure({ attempt: 1, httpStatus: 429, maxAttempts: 8 })
    ).toBe('retry');
    expect(
      classifyDeliveryFailure({ attempt: 1, httpStatus: 503, maxAttempts: 8 })
    ).toBe('retry');
  });

  it('does not blindly retry an ambiguous send', () => {
    expect(
      classifyDeliveryFailure({
        attempt: 1,
        maxAttempts: 8,
        requestMayHaveBeenSent: true,
      })
    ).toBe('delivery_unknown');
  });

  it('dead-letters exhausted and permanent failures', () => {
    expect(classifyDeliveryFailure({ attempt: 8, maxAttempts: 8 })).toBe(
      'dead_letter'
    );
    expect(
      classifyDeliveryFailure({
        attempt: 1,
        errorCode: 'destination_not_configured',
        maxAttempts: 8,
      })
    ).toBe('dead_letter');
    expect(
      classifyDeliveryFailure({
        attempt: 1,
        errorCode: 'paid_order_not_deliverable',
        maxAttempts: 8,
      })
    ).toBe('dead_letter');
  });
});
