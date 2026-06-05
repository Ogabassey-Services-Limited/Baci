import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { createBNPLCheckoutAppNavigation } from './bnpl-checkout-app-navigation';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

describe('createBNPLCheckoutAppNavigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    alertSpy.mockRestore();
  });

  it('shows a cancellation alert that returns to the app when confirmed', () => {
    const navigation = createBNPLCheckoutAppNavigation();

    navigation.showCancelAlert();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancel Payment?',
      'Are you sure you want to cancel this payment?',
      [
        { text: 'Continue Payment', style: 'cancel' },
        expect.objectContaining({
          text: 'Cancel',
          style: 'destructive',
        }),
      ]
    );

    const actions = alertSpy.mock.calls[0]?.[2] as
      | Array<{ onPress?: () => void }>
      | undefined;
    actions?.[1]?.onPress?.();

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('navigates to order success after the provider confirms payment', () => {
    const navigation = createBNPLCheckoutAppNavigation();

    navigation.scheduleOrderSuccess({
      gateway: 'credit_direct',
      orderId: 'order-123',
      reference: 'BAC-123',
      trackingToken: 'track-token-123',
    });

    expect(router.replace).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        paymentMethod: 'credit_direct',
        reference: 'BAC-123',
        trackingToken: 'track-token-123',
      },
    });
  });

  it('omits optional order success params when they are not present', () => {
    const navigation = createBNPLCheckoutAppNavigation();

    navigation.scheduleOrderSuccess({
      gateway: 'credit_direct',
      orderId: 'order-123',
      reference: null,
    });

    jest.advanceTimersByTime(1000);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        paymentMethod: 'credit_direct',
      },
    });
  });

  it('replaces a pending order success navigation with the latest one', () => {
    const navigation = createBNPLCheckoutAppNavigation();

    navigation.scheduleOrderSuccess({
      gateway: 'provider_a',
      orderId: 'order-1',
    });
    jest.advanceTimersByTime(500);

    navigation.scheduleOrderSuccess({
      gateway: 'provider_b',
      orderId: 'order-2',
    });
    jest.advanceTimersByTime(1000);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-2',
        paymentMethod: 'provider_b',
      },
    });
  });

  it('cancels a pending order success navigation before it fires', () => {
    const navigation = createBNPLCheckoutAppNavigation();

    navigation.scheduleOrderSuccess({
      gateway: 'credit_direct',
      orderId: 'order-123',
    });
    jest.advanceTimersByTime(500);

    navigation.cancelOrderSuccessNavigation();
    jest.advanceTimersByTime(1000);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not navigate when required order success params are missing', () => {
    const navigation = createBNPLCheckoutAppNavigation();

    navigation.scheduleOrderSuccess({
      gateway: 'credit_direct',
      orderId: 'order-123',
    });
    navigation.scheduleOrderSuccess({
      gateway: 'credit_direct',
    });

    jest.advanceTimersByTime(1000);

    expect(router.replace).not.toHaveBeenCalled();
  });
});
