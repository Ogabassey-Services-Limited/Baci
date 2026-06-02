export type BNPLWebViewMessageEvent = { nativeEvent: { data: string } };

export function logBNPLCheckoutDebug(eventName: string, details: unknown) {
  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.NODE_ENV !== 'test'
  ) {
    console.info(`[BNPLCheckout] ${eventName}`, details);
  }
}

export function createBNPLWebViewMessageHandler() {
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
        logBNPLCheckoutDebug('diagnostic navigation message', {
          url: payload.url,
        });
      } else if (
        payload.type === 'bnpl_log' ||
        payload.type === 'bnpl_error_log' ||
        payload.type === 'bnpl_success' ||
        payload.type === 'bnpl_error' ||
        payload.type === 'bnpl_close'
      ) {
        logBNPLCheckoutDebug('webview message', payload);
      }
    } catch {
      logBNPLCheckoutDebug('ignored non-json webview message', {
        data: event.nativeEvent.data,
      });
    }
  };
}
