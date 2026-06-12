import type { WebViewOpenWindowEventLike } from './BNPLCheckoutWebView';
import {
  BNPL_UNTRUSTED_POPUP_MESSAGE,
  getBNPLDebugUrlDetails,
} from './bnpl-checkout.helpers';
import { resolveBNPLPopupTargetAction } from './bnpl-checkout-controller-actions';
import { logBNPLCheckoutDebug } from './bnpl-checkout-message-handler';

interface BNPLOpenWindowHandlerDeps {
  apiBaseUrl: string;
  merchantDomain: string | undefined;
  merchantSlug: string | undefined;
  clearPendingLoadTimeout: () => void;
  scheduleLoadTimeout: () => void;
  setCheckoutStatus: (status: 'loading' | 'error') => void;
  setCurrentUrl: (url: string) => void;
  setErrorMessage: (message: string | null) => void;
}

// Auxiliary-window (popup) requests from the BNPL provider WebView: trusted
// targets continue the checkout in the same WebView, untrusted ones surface a
// security error instead of opening arbitrary URLs.
export function createBNPLOpenWindowHandler({
  apiBaseUrl,
  merchantDomain,
  merchantSlug,
  clearPendingLoadTimeout,
  scheduleLoadTimeout,
  setCheckoutStatus,
  setCurrentUrl,
  setErrorMessage,
}: BNPLOpenWindowHandlerDeps) {
  return (event: WebViewOpenWindowEventLike) => {
    const targetDetails = getBNPLDebugUrlDetails(event.nativeEvent.targetUrl);
    logBNPLCheckoutDebug('auxiliary window requested', {
      target: targetDetails,
    });

    const action = resolveBNPLPopupTargetAction({
      apiBaseUrl,
      merchantDomain,
      merchantSlug,
      targetUrl: event.nativeEvent.targetUrl,
    });
    if (action.type === 'ignore') {
      return;
    }

    logBNPLCheckoutDebug('auxiliary window decision', {
      actionType: action.type,
      target: targetDetails,
      targetUrl: action.targetUrl,
    });

    if (action.type === 'untrusted') {
      clearPendingLoadTimeout();
      setCheckoutStatus('error');
      setErrorMessage(BNPL_UNTRUSTED_POPUP_MESSAGE);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[BNPLCheckout] Ignored untrusted auxiliary window', {
          target: targetDetails,
          targetUrl: action.targetUrl,
        });
      }
      return;
    }

    setErrorMessage(null);
    scheduleLoadTimeout();
    setCheckoutStatus('loading');
    setCurrentUrl(action.targetUrl);
  };
}
