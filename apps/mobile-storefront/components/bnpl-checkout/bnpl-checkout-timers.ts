import type { RefObject } from 'react';
import {
  BNPL_LOAD_TIMEOUT_MESSAGE,
  BNPL_LOAD_TIMEOUT_MS,
} from './bnpl-checkout.helpers';

interface BNPLLoadTimersInput<TStatus extends string> {
  loadTimeoutRef: RefObject<ReturnType<typeof setTimeout> | null>;
  setCheckoutStatus: (status: TStatus) => void;
  setErrorMessage: (message: string | null) => void;
  statusRef: RefObject<TStatus>;
}

export function createBNPLLoadTimers<TStatus extends string>({
  loadTimeoutRef,
  setCheckoutStatus,
  setErrorMessage,
  statusRef,
}: BNPLLoadTimersInput<TStatus>) {
  const clearPendingLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const scheduleLoadTimeout = () => {
    clearPendingLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = null;
      if (statusRef.current !== 'loading') {
        return;
      }
      setErrorMessage(BNPL_LOAD_TIMEOUT_MESSAGE);
      setCheckoutStatus('error' as TStatus);
    }, BNPL_LOAD_TIMEOUT_MS);
  };

  return {
    clearPendingLoadTimeout,
    scheduleLoadTimeout,
  };
}
