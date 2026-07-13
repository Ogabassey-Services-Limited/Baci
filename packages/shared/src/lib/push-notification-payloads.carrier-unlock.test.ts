import { describe, expect, it } from 'vitest';
import { getStorefrontNotificationNavigationTarget } from './push-notification-payloads';

describe('carrier-unlock push navigation', () => {
  it('routes carrier-unlock updates to the unlock-orders screen', () => {
    expect(
      getStorefrontNotificationNavigationTarget({
        type: 'carrier_unlock',
        orderId: 'unlock-order-1',
      })
    ).toEqual({ screen: 'unlock-orders' });
  });
});
