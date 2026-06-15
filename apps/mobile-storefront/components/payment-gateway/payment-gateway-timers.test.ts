import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  PAYMENT_LOAD_TIMEOUT_MESSAGE,
  PAYMENT_LOAD_TIMEOUT_MS,
} from './payment-gateway-controller.helpers';
import type {
  PaymentGatewayRefs,
  PaymentGatewayStatus,
} from './payment-gateway-controller.types';
import { createPaymentGatewayTimers } from './payment-gateway-timers';

function createRefs(
  status: PaymentGatewayStatus = 'loading'
): PaymentGatewayRefs {
  return {
    copiedGatewayTextRef: { current: null },
    isMountedRef: { current: true },
    loadTimeoutRef: { current: null },
    navigationTimeoutRef: { current: null },
    paymentCompletionStartedRef: { current: false },
    savingsAuthorizationAbortRef: { current: null },
    statusRef: { current: status },
    vtuConfirmationTokenRef: { current: 0 },
    webViewRef: { current: null },
  } as unknown as PaymentGatewayRefs;
}

describe('createPaymentGatewayTimers', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not enter the load-timeout error state when onLoadTimeout handles it', () => {
    jest.useFakeTimers();
    const refs = createRefs();
    const setErrorMessage = jest.fn();
    const setPaymentStatus = jest.fn();
    const timers = createPaymentGatewayTimers({
      onLoadTimeout: () => true,
      refs,
      setErrorMessage,
      setPaymentStatus,
    });

    timers.scheduleLoadTimeout();
    jest.advanceTimersByTime(PAYMENT_LOAD_TIMEOUT_MS);

    expect(setErrorMessage).not.toHaveBeenCalled();
    expect(setPaymentStatus).not.toHaveBeenCalled();
  });

  it('falls back to the load-timeout error state when onLoadTimeout throws', () => {
    jest.useFakeTimers();
    const refs = createRefs();
    const setErrorMessage = jest.fn();
    const setPaymentStatus = jest.fn();
    const timers = createPaymentGatewayTimers({
      onLoadTimeout: () => {
        throw new Error('completion handler failed');
      },
      refs,
      setErrorMessage,
      setPaymentStatus,
    });

    timers.scheduleLoadTimeout();

    expect(() => {
      jest.advanceTimersByTime(PAYMENT_LOAD_TIMEOUT_MS);
    }).not.toThrow();
    expect(setErrorMessage).toHaveBeenCalledWith(PAYMENT_LOAD_TIMEOUT_MESSAGE);
    expect(setPaymentStatus).toHaveBeenCalledWith('error');
  });
});
