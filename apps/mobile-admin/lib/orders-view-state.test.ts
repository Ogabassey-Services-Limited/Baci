import { describe, expect, it } from 'vitest';
import { getOrdersViewState } from './orders-view-state';

describe('getOrdersViewState', () => {
  it('returns ready when orders are already available', () => {
    expect(
      getOrdersViewState({
        hasMerchant: true,
        isMerchantLoading: false,
        merchantError: new Error('merchant failed'),
        isOrdersLoading: false,
        ordersError: new Error('orders failed'),
        ordersLength: 3,
      })
    ).toEqual({ status: 'ready' });
  });

  it('returns loading while merchant or orders are loading without data', () => {
    expect(
      getOrdersViewState({
        hasMerchant: false,
        isMerchantLoading: true,
        merchantError: null,
        isOrdersLoading: false,
        ordersError: null,
        ordersLength: 0,
      })
    ).toEqual({ status: 'loading' });
  });

  it('returns a merchant error state when merchant lookup fails', () => {
    expect(
      getOrdersViewState({
        hasMerchant: false,
        isMerchantLoading: false,
        merchantError: new Error('merchant failed'),
        isOrdersLoading: false,
        ordersError: null,
        ordersLength: 0,
      })
    ).toEqual({
      status: 'error',
      title: 'Failed to load store',
      message:
        'We could not load your store context for this account. Try again or sign in again if the issue persists.',
    });
  });

  it('returns a merchant unavailable state when no merchant exists after loading', () => {
    expect(
      getOrdersViewState({
        hasMerchant: false,
        isMerchantLoading: false,
        merchantError: null,
        isOrdersLoading: false,
        ordersError: null,
        ordersLength: 0,
      })
    ).toEqual({
      status: 'error',
      title: 'Store unavailable',
      message:
        'No merchant account is linked to this session right now. Refresh the screen or sign in again.',
    });
  });

  it('returns an orders error state when the orders query fails', () => {
    expect(
      getOrdersViewState({
        hasMerchant: true,
        isMerchantLoading: false,
        merchantError: null,
        isOrdersLoading: false,
        ordersError: new Error('orders failed'),
        ordersLength: 0,
      })
    ).toEqual({
      status: 'error',
      title: 'Failed to load orders',
      message:
        'We could not load your orders right now. Pull to refresh or try again.',
    });
  });

  it('returns empty when loading succeeded and no orders exist', () => {
    expect(
      getOrdersViewState({
        hasMerchant: true,
        isMerchantLoading: false,
        merchantError: null,
        isOrdersLoading: false,
        ordersError: null,
        ordersLength: 0,
      })
    ).toEqual({ status: 'empty' });
  });
});
