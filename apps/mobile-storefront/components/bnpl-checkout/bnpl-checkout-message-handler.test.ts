import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  createBNPLWebViewMessageHandler,
  logBNPLCheckoutDebug,
} from './bnpl-checkout-message-handler';

describe('createBNPLWebViewMessageHandler', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDev = (globalThis as typeof globalThis & { __DEV__?: boolean })
    .__DEV__;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ =
      originalDev;
    jest.restoreAllMocks();
  });

  it('treats terminal WebView messages as diagnostics only', () => {
    process.env.NODE_ENV = 'development';
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const handler = createBNPLWebViewMessageHandler();

    handler({
      nativeEvent: {
        data: JSON.stringify({
          reference: 'forged-reference',
          type: 'bnpl_success',
        }),
      },
    });

    expect(info).toHaveBeenCalledWith(
      '[BNPLCheckout] webview message',
      expect.objectContaining({
        reference: 'forged-reference',
        type: 'bnpl_success',
      })
    );
  });

  it('logs navigation messages without treating them as verified redirects', () => {
    process.env.NODE_ENV = 'development';
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const handler = createBNPLWebViewMessageHandler();

    handler({
      nativeEvent: {
        data: JSON.stringify({
          type: 'navigation',
          url: 'https://evil.example/order-success?reference=forged',
        }),
      },
    });

    expect(info).toHaveBeenCalledWith(
      '[BNPLCheckout] diagnostic navigation message',
      {
        url: 'https://evil.example/order-success?reference=forged',
      }
    );
  });
});

describe('logBNPLCheckoutDebug', () => {
  it('stays silent in test mode', () => {
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    logBNPLCheckoutDebug('event', { ok: true });

    expect(info).not.toHaveBeenCalled();
  });
});
