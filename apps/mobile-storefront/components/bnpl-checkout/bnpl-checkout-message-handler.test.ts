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

  it('logs navigation messages and delegates URL handling to the controller', () => {
    process.env.NODE_ENV = 'development';
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const onNavigationMessage = jest.fn();
    const handler = createBNPLWebViewMessageHandler({ onNavigationMessage });

    handler({
      nativeEvent: {
        data: JSON.stringify({
          type: 'navigation',
          url: 'https://ogabassey.usebaci.com/order-success?reference=BAC-123',
        }),
      },
    });

    expect(info).toHaveBeenCalledWith(
      '[BNPLCheckout] diagnostic navigation message',
      {
        url: 'https://ogabassey.usebaci.com/order-success?reference=BAC-123',
      }
    );
    expect(onNavigationMessage).toHaveBeenCalledWith(
      'https://ogabassey.usebaci.com/order-success?reference=BAC-123'
    );
  });

  it('logs and ignores primitive JSON messages', () => {
    process.env.NODE_ENV = 'development';
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const handler = createBNPLWebViewMessageHandler();

    handler({
      nativeEvent: {
        data: JSON.stringify(true),
      },
    });

    expect(info).toHaveBeenCalledWith(
      '[BNPLCheckout] ignored primitive webview message',
      { data: 'true' }
    );
  });

  it('logs and ignores non-JSON messages', () => {
    process.env.NODE_ENV = 'development';
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
    const info = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const handler = createBNPLWebViewMessageHandler();

    handler({
      nativeEvent: {
        data: 'not-a-json',
      },
    });

    expect(info).toHaveBeenCalledWith(
      '[BNPLCheckout] ignored non-json webview message',
      { data: 'not-a-json' }
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
