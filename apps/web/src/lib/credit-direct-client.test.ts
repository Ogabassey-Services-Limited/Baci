import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openCreditDirectCheckout } from './credit-direct-client';

describe('openCreditDirectCheckout', () => {
  const options = {
    amount: 12000,
    customerEmail: 'customer@example.com',
    customerName: 'Ada Customer',
    customerPhone: '08012345678',
    items: [{ id: 'product-1', name: 'Phone Case', price: 12000, quantity: 1 }],
    merchantSlug: 'test-store',
    orderId: 'order-123',
    onClose: vi.fn(),
    onError: vi.fn(),
    onPopup: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document
      .querySelectorAll(
        'script[src="https://checkout.creditdirect.ng/bnpl/checkout.min.js"]'
      )
      .forEach((script) => {
        script.remove();
      });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          isLive: true,
          publicKey: 'cd-public-key',
          sessionId: 'session-123',
          signature: 'signature-123',
        }),
        ok: true,
      })
    );
    delete window.Connect;
  });

  it('reports sign endpoint errors without opening Credit Direct', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ error: 'Invalid request' }),
        ok: false,
      })
    );

    await openCreditDirectCheckout(options);

    expect(options.onError).toHaveBeenCalledWith('Invalid request');
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();
  });

  it('reports script load failures', async () => {
    const appendSpy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => {
        node.dispatchEvent(new Event('error'));
        return node;
      });

    await openCreditDirectCheckout(options);

    expect(options.onError).toHaveBeenCalledWith(
      'Failed to load Credit Direct script'
    );
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.onClose).not.toHaveBeenCalled();
    appendSpy.mockRestore();
  });

  it('does not report cancellation after Credit Direct emits success then closes', async () => {
    window.Connect = function MockConnect(config: {
      onClose: () => void;
      onSuccess: (payload: { checkoutTransactionId: string }) => void;
    }) {
      return {
        open: () => {
          config.onSuccess({ checkoutTransactionId: 'cd-transaction-123' });
          config.onClose();
        },
        setup: vi.fn(),
      };
    } as never;

    await openCreditDirectCheckout(options);

    expect(options.onSuccess).toHaveBeenCalledWith('cd-transaction-123');
    expect(options.onClose).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('falls back to the signed session id when success has no transaction id', async () => {
    window.Connect = function MockConnect(config: { onSuccess: () => void }) {
      return {
        open: () => config.onSuccess(),
        setup: vi.fn(),
      };
    } as never;

    await openCreditDirectCheckout(options);

    expect(options.onSuccess).toHaveBeenCalledWith('session-123');
  });

  it('reports cancellation when Credit Direct closes before success', async () => {
    window.Connect = function MockConnect(config: { onClose: () => void }) {
      return {
        open: () => config.onClose(),
        setup: vi.fn(),
      };
    } as never;

    await openCreditDirectCheckout(options);

    expect(options.onClose).toHaveBeenCalledTimes(1);
    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('reports popup transaction ids from the Credit Direct SDK', async () => {
    window.Connect = function MockConnect(config: {
      onPopup: (payload: { checkoutTransactionId: string }) => void;
    }) {
      return {
        open: () =>
          config.onPopup({ checkoutTransactionId: ' cd-popup-transaction-1 ' }),
        setup: vi.fn(),
      };
    } as never;

    await openCreditDirectCheckout(options);

    expect(options.onPopup).toHaveBeenCalledWith('cd-popup-transaction-1');
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('falls back to the signed session id for popup events without a transaction id', async () => {
    window.Connect = function MockConnect(config: {
      onPopup: (payload?: { checkoutTransactionId?: string }) => void;
    }) {
      return {
        open: () => config.onPopup({ checkoutTransactionId: '   ' }),
        setup: vi.fn(),
      };
    } as never;

    await openCreditDirectCheckout(options);

    expect(options.onPopup).toHaveBeenCalledWith('session-123');
    expect(options.onError).not.toHaveBeenCalled();
  });
});
