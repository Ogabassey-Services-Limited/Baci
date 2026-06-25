import { describe, expect, it, vi } from 'vitest';
import { navigateToNotificationTarget } from './push-notification-navigation';

describe('navigateToNotificationTarget', () => {
  it('routes entity notifications with encoded ids', () => {
    const router = { push: vi.fn() };

    navigateToNotificationTarget(router, {
      params: { id: 'order 123' },
      screen: 'order',
    });
    navigateToNotificationTarget(router, {
      params: { id: 'phone/sku' },
      screen: 'product',
    });

    expect(router.push).toHaveBeenNthCalledWith(
      1,
      '/(admin)/order/order%20123'
    );
    expect(router.push).toHaveBeenNthCalledWith(
      2,
      '/(admin)/product/phone%2Fsku'
    );
  });

  it('routes aggregate and unknown notifications to safe fallbacks', () => {
    const router = { push: vi.fn() };

    navigateToNotificationTarget(router, { screen: 'orders' });
    navigateToNotificationTarget(router, { screen: 'unknown' });
    navigateToNotificationTarget(router, null);

    expect(router.push).toHaveBeenNthCalledWith(1, '/(admin)/(tabs)/orders');
    expect(router.push).toHaveBeenNthCalledWith(2, '/(admin)/(tabs)');
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it('routes negotiation notifications to the list screen (no detail route exists)', () => {
    const router = { push: vi.fn() };

    // A negotiation push carries an id, but there is no `negotiations/[id]`
    // screen — routing to it throws "Unmatched Route". Both the id and no-id
    // cases must land on the list screen.
    navigateToNotificationTarget(router, {
      params: { id: 'abc-123' },
      screen: 'negotiation',
    });
    navigateToNotificationTarget(router, { screen: 'negotiations' });

    expect(router.push).toHaveBeenNthCalledWith(1, '/(admin)/negotiations');
    expect(router.push).toHaveBeenNthCalledWith(2, '/(admin)/negotiations');
  });
});
