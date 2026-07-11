import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { navigateFromPushScreen } from './navigate-from-push-screen';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const push = router.push as jest.MockedFunction<typeof router.push>;

describe('navigateFromPushScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes to a specific order when an id is provided', () => {
    navigateFromPushScreen('order-details', { id: 'order-123' });

    expect(push).toHaveBeenCalledWith('/orders/order-123');
  });

  it('falls back to the orders list when the order id is missing', () => {
    navigateFromPushScreen('order-details');

    expect(push).toHaveBeenCalledWith('/orders');
  });

  it('routes repair notification targets to the repairs screen', () => {
    navigateFromPushScreen('repairs', { id: 'repair-123' });

    expect(push).toHaveBeenCalledWith('/repairs');
  });

  it('routes to a product when a slug is provided', () => {
    navigateFromPushScreen('product', { slug: 'iphone-13' });

    expect(push).toHaveBeenCalledWith('/product/iphone-13');
  });

  it('falls back to home when the product slug is missing', () => {
    navigateFromPushScreen('product', {});

    expect(push).toHaveBeenCalledWith('/');
  });

  it('falls back to home when the category slug is missing', () => {
    navigateFromPushScreen('category');

    expect(push).toHaveBeenCalledWith('/');
  });

  it('opens the savings wallet panel for savings actions', () => {
    navigateFromPushScreen('wallet', { action: 'savings' });

    expect(push).toHaveBeenCalledWith({
      pathname: '/wallet',
      params: { action: 'savings' },
    });
  });

  it('opens the plain wallet for non-savings wallet actions', () => {
    navigateFromPushScreen('wallet', {});

    expect(push).toHaveBeenCalledWith('/wallet');
  });

  it('defaults the utility-history type to power when unspecified', () => {
    navigateFromPushScreen('utility-history');

    expect(push).toHaveBeenCalledWith('/utilities/history?type=power');
  });

  it('routes unknown screens to home', () => {
    navigateFromPushScreen('unknown-screen');

    expect(push).toHaveBeenCalledWith('/');
  });
});
