import { describe, expect, it } from 'vitest';
import { canCancelAdminNotification } from './notification-cancellation';

describe('canCancelAdminNotification', () => {
  it('allows only pending, unsent notification work to be cancelled', () => {
    expect(
      canCancelAdminNotification({ delivery_state: 'pending', sent_at: null })
    ).toBe(true);
  });

  it.each([
    'processing',
    'sent',
    'failed',
    'expired',
  ] as const)('retains %s delivery history', (deliveryState) => {
    expect(
      canCancelAdminNotification({
        delivery_state: deliveryState,
        sent_at: deliveryState === 'sent' ? '2026-08-05T12:00:00.000Z' : null,
      })
    ).toBe(false);
  });
});
