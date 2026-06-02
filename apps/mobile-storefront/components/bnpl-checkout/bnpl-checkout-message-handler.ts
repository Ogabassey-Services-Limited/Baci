export type BNPLWebViewMessageEvent = { nativeEvent: { data: string } };

type BNPLTerminalStatus = 'success' | 'error';

interface BNPLWebViewMessageHandlerInput {
  clearCart: () => void;
  clearPendingLoadTimeout: () => void;
  handleClose: () => void;
  handleNavigationUrl: (url: string) => void;
  replaceWithOrderSuccess: (reference?: string | null) => void;
  setCheckoutStatus: (status: BNPLTerminalStatus) => void;
  setErrorMessage: (message: string | null) => void;
}

export function logBNPLCheckoutDebug(eventName: string, details: unknown) {
  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.NODE_ENV !== 'test'
  ) {
    console.info(`[BNPLCheckout] ${eventName}`, details);
  }
}

export function createBNPLWebViewMessageHandler({
  clearCart,
  clearPendingLoadTimeout,
  handleClose,
  handleNavigationUrl,
  replaceWithOrderSuccess,
  setCheckoutStatus,
  setErrorMessage,
}: BNPLWebViewMessageHandlerInput) {
  return (event: BNPLWebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as unknown;
      if (!data || typeof data !== 'object') {
        logBNPLCheckoutDebug('ignored primitive webview message', {
          data: event.nativeEvent.data,
        });
        return;
      }
      const payload = data as Record<string, unknown>;

      if (payload.type === 'navigation' && typeof payload.url === 'string') {
        handleNavigationUrl(payload.url);
      } else if (
        payload.type === 'bnpl_log' ||
        payload.type === 'bnpl_error_log'
      ) {
        logBNPLCheckoutDebug('webview message', payload);
      } else if (payload.type === 'bnpl_success') {
        clearPendingLoadTimeout();
        setCheckoutStatus('success');
        clearCart();
        replaceWithOrderSuccess(
          typeof payload.reference === 'string' ? payload.reference : null
        );
      } else if (payload.type === 'bnpl_error') {
        clearPendingLoadTimeout();
        setCheckoutStatus('error');
        setErrorMessage(
          typeof payload.message === 'string'
            ? payload.message
            : 'Payment failed.'
        );
      } else if (payload.type === 'bnpl_close') {
        handleClose();
      }
    } catch {
      logBNPLCheckoutDebug('ignored non-json webview message', {
        data: event.nativeEvent.data,
      });
    }
  };
}
