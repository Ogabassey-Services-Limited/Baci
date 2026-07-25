import { describe, expect, it, vi } from 'vitest';
import {
  type OpenLegacyCreditDirectPopupParams,
  openLegacyCreditDirectPopup,
} from './open-legacy-credit-direct-popup';

interface ConnectConfig {
  transaction: {
    totalAmount: number;
    products: Array<{ productAmount: number; productId: string }>;
  };
  onSuccess: (r?: { checkoutTransactionId?: string }) => void;
  onClose: () => void;
  onPopup: (r?: { checkoutTransactionId?: string }) => void;
}

function harness(overrides: Partial<OpenLegacyCreditDirectPopupParams> = {}) {
  const setup = vi.fn();
  const open = vi.fn();
  let config: ConnectConfig | undefined;
  // Regular function (not an arrow) so it can be invoked with `new`.
  const connect = vi.fn(function connectMock(cfg: ConnectConfig) {
    config = cfg;
    return { setup, open };
  }) as unknown as typeof window.Connect;
  const toast = vi.fn();
  const setLoading = vi.fn();
  const onSuccess = vi.fn();
  const onPopup = vi.fn();

  const params: OpenLegacyCreditDirectPopupParams = {
    sign: {
      signature: 'sig',
      publicKey: 'pk',
      sessionId: 'sess-1',
      isLive: true,
      amount: 20000,
    },
    orderId: 'order-1',
    orderItems: [
      { product_id: 'p1', name: 'Phone', price: 20000, quantity: 1 },
    ],
    customerEmail: 'buyer@example.com',
    customerPhone: '08000000000',
    connect,
    toast,
    setLoading,
    onSuccess,
    onPopup,
    ...overrides,
  };

  return {
    connect,
    setup,
    open,
    toast,
    setLoading,
    onSuccess,
    onPopup,
    params,
    getConfig: () => config,
  };
}

describe('openLegacyCreditDirectPopup', () => {
  it('toasts and clears loading when the SDK is not loaded', () => {
    const h = harness({ connect: undefined });

    openLegacyCreditDirectPopup(h.params);

    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Credit Direct SDK not loaded',
      })
    );
    expect(h.setLoading).toHaveBeenCalledWith(false);
  });

  it('fails closed without opening the popup when the signed amount is invalid', () => {
    const h = harness();
    h.params.sign.amount = 0;

    openLegacyCreditDirectPopup(h.params);

    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
    expect(h.setLoading).toHaveBeenCalledWith(false);
    expect(h.connect).not.toHaveBeenCalled();
    expect(h.open).not.toHaveBeenCalled();
  });

  it('opens the popup with the server-signed amount allocated over the order items', () => {
    const h = harness();

    openLegacyCreditDirectPopup(h.params);

    const config = h.getConfig();
    expect(config?.transaction.totalAmount).toBe(20000);
    const productSum = (config?.transaction.products ?? []).reduce(
      (sum, product) => sum + product.productAmount,
      0
    );
    expect(productSum).toBe(20000);
    expect(h.setup).toHaveBeenCalledTimes(1);
    expect(h.open).toHaveBeenCalledTimes(1);
  });

  it('toasts cancellation and clears loading when the popup is closed', () => {
    const h = harness();

    openLegacyCreditDirectPopup(h.params);
    h.getConfig()?.onClose();

    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Checkout Cancelled' })
    );
    expect(h.setLoading).toHaveBeenCalledWith(false);
  });

  it('wires the page-provided success and popup handlers to the SDK', () => {
    const h = harness();

    openLegacyCreditDirectPopup(h.params);
    const config = h.getConfig();
    config?.onSuccess({ checkoutTransactionId: 'tx-1' });
    config?.onPopup({ checkoutTransactionId: 'tx-1' });

    expect(h.onSuccess).toHaveBeenCalledWith({ checkoutTransactionId: 'tx-1' });
    expect(h.onPopup).toHaveBeenCalledWith({ checkoutTransactionId: 'tx-1' });
  });
});
