import {
  PAYMENT_LOAD_TIMEOUT_MESSAGE,
  PAYMENT_LOAD_TIMEOUT_MS,
  PAYMENT_SUCCESS_NAV_DELAY_MS,
} from './payment-gateway-controller.helpers';
import type {
  PaymentGatewayRefs,
  PaymentStatusSetter,
} from './payment-gateway-controller.types';

interface PaymentGatewayTimerInput {
  refs: PaymentGatewayRefs;
  setErrorMessage: (message: string | null) => void;
  setPaymentStatus: PaymentStatusSetter;
}

export function createPaymentGatewayTimers({
  refs,
  setErrorMessage,
  setPaymentStatus,
}: PaymentGatewayTimerInput) {
  const clearPendingNavigation = () => {
    if (refs.navigationTimeoutRef.current) {
      clearTimeout(refs.navigationTimeoutRef.current);
      refs.navigationTimeoutRef.current = null;
    }
  };

  const clearPendingLoadTimeout = () => {
    if (refs.loadTimeoutRef.current) {
      clearTimeout(refs.loadTimeoutRef.current);
      refs.loadTimeoutRef.current = null;
    }
  };

  const scheduleLoadTimeout = () => {
    if (!refs.isMountedRef.current) {
      return;
    }
    clearPendingLoadTimeout();
    refs.loadTimeoutRef.current = setTimeout(() => {
      refs.loadTimeoutRef.current = null;
      if (!refs.isMountedRef.current) {
        return;
      }
      if (refs.statusRef.current !== 'loading') {
        return;
      }
      setErrorMessage(PAYMENT_LOAD_TIMEOUT_MESSAGE);
      setPaymentStatus('error');
    }, PAYMENT_LOAD_TIMEOUT_MS);
  };

  const scheduleDelayedNavigation = (navigate: () => void) => {
    if (!refs.isMountedRef.current) {
      return;
    }
    clearPendingNavigation();
    refs.navigationTimeoutRef.current = setTimeout(() => {
      refs.navigationTimeoutRef.current = null;
      if (refs.isMountedRef.current) {
        navigate();
      }
    }, PAYMENT_SUCCESS_NAV_DELAY_MS);
  };

  return {
    clearPendingLoadTimeout,
    clearPendingNavigation,
    scheduleDelayedNavigation,
    scheduleLoadTimeout,
  };
}
