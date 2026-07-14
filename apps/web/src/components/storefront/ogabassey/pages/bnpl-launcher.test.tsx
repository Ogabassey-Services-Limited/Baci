import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetKlumpSdkLoadForTests } from '@/lib/klump-sdk';
import { BnplLauncher, KLUMP_REDIRECT_URL_KEY } from './bnpl-launcher';
import {
  CREDIT_DIRECT_POPUP_MARKER_PREFIX,
  readCreditDirectPopupMarker,
} from './checkout/credit-direct-popup-return';
import { CHECKOUT_PENDING_ORDER_STORAGE_KEY } from './checkout/pending-checkout-order';

const mockPush = vi.fn();
const mockRouter = { push: mockPush };
const mockSearchParams = vi.fn();
const mockOpenCreditDirectCheckout = vi.fn();
const mockOpenCredPalCheckout = vi.fn();
const mockApiPost = vi.fn();
const mockKlumpConstructor = vi.fn();

interface TestReactNativeWebViewWindow extends Window {
  ReactNativeWebView?: {
    postMessage: (message: string) => void;
  };
}

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => mockRouter),
  useSearchParams: vi.fn(() => mockSearchParams()),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { slug: 'test-store' },
    loading: false,
  })),
}));

vi.mock('@/lib/credit-direct-client', () => ({
  openCreditDirectCheckout: (...args: unknown[]) =>
    mockOpenCreditDirectCheckout(...args),
}));

vi.mock('@/lib/credpal', () => ({
  openCredPalCheckout: (...args: unknown[]) =>
    mockOpenCredPalCheckout(...args),
  getCredPalKey: vi.fn(() => 'credpal_test_key'),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

describe('BnplLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/checkout/bnpl');
    window.sessionStorage.clear();
    window.localStorage.clear();
    Reflect.deleteProperty(window, 'ReactNativeWebView');
    document
      .querySelectorAll('script[src="https://js.useklump.com/klump.js"]')
      .forEach((script) => script.remove());
    document
      .querySelectorAll('#klump_checkout, #klump__checkout')
      .forEach((element) => element.remove());
    delete (window as TestReactNativeWebViewWindow).ReactNativeWebView;
    resetKlumpSdkLoadForTests();
    window.Klump = mockKlumpConstructor as never;
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credit_direct',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockApiPost.mockResolvedValue({ success: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          total: 1000,
          customer_email: 'customer@example.com',
          customer_phone: '08012345678',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 1000,
              quantity: 1,
            },
          ],
        }),
      })
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('loads BNPL order details once across launcher status transitions', async () => {
    render(<BnplLauncher />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=tok-123'
      );
    });
    await waitFor(() => {
      expect(mockOpenCreditDirectCheckout).toHaveBeenCalledOnce();
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('includes a persisted customer email alongside the tracking token when available', async () => {
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        trackingToken: 'tok-123',
        customerEmail: 'customer@example.com',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=tok-123&email=customer%40example.com'
      );
    });
  });

  it('falls back to the stored pending-order tracking token for legacy links', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credit_direct',
        merchant_slug: 'test-store',
      })
    );
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        trackingToken: 'stored-track-token',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=stored-track-token'
      );
    });
  });

  it('preserves trackingToken when redirecting after Credit Direct success', async () => {
    mockOpenCreditDirectCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess('ref-1');
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/order-success?orderId=order-1&reference=ref-1&type=credit_direct&trackingToken=track-order-token'
      );
    });
  });

  it('normalizes string order totals before signing Credit Direct checkout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          total: '349613.00',
          customer_email: 'customer@example.com',
          customer_phone: '08012345678',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 349613,
              quantity: 1,
            },
          ],
        }),
      })
    );
    mockOpenCreditDirectCheckout.mockResolvedValue(undefined);

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockOpenCreditDirectCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 349613 })
      );
    });
  });

  it('uses pending checkout contact details when public order data is redacted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          total: 1000,
          customer_email: 'cu***@example.com',
          customer_phone: '+2**********78',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 1000,
              quantity: 1,
            },
          ],
        }),
      })
    );
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        trackingToken: 'tok-123',
        customerEmail: 'customer@example.com',
        customerPhone: '+2348012345678',
      })
    );
    mockOpenCreditDirectCheckout.mockResolvedValue(undefined);

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockOpenCreditDirectCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'customer@example.com',
          customerPhone: '+2348012345678',
        })
      );
    });
  });

  it('rejects invalid Credit Direct order totals before opening checkout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          total: 'not-a-number',
          customer_email: 'customer@example.com',
          customer_phone: '08012345678',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 1000,
              quantity: 1,
            },
          ],
        }),
      })
    );

    render(<BnplLauncher />);

    expect(
      await screen.findByText('Invalid order total for Credit Direct checkout.')
    ).toBeInTheDocument();
    expect(mockOpenCreditDirectCheckout).not.toHaveBeenCalled();
  });

  it('stores Credit Direct popup transaction ids with the public tracking token', async () => {
    mockOpenCreditDirectCheckout.mockImplementation(({ onPopup }) => {
      onPopup('cd-popup-transaction-1');
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/orders/update-payment-ref',
        {
          gateway: 'credit_direct',
          orderId: 'order-1',
          paymentRef: 'cd-popup-transaction-1',
          tracking_token: 'track-order-token',
        }
      );
    });
  });

  it('bridges Credit Direct close events to React Native without rendering cancellation UI', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'ReactNativeWebView', {
      configurable: true,
      value: { postMessage },
    });
    mockOpenCreditDirectCheckout.mockImplementation(({ onClose }) => {
      onClose();
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        JSON.stringify({
          gateway: 'credit_direct',
          message: 'Credit Direct checkout closed',
          type: 'bnpl_close',
        })
      );
    });
    expect(
      screen.queryByText('Payment cancelled. Please try again.')
    ).not.toBeInTheDocument();
  });

  it('logs and continues when Credit Direct popup reference persistence fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApiPost.mockRejectedValueOnce(new Error('Update failed'));
    mockOpenCreditDirectCheckout.mockImplementation(({ onPopup }) => {
      onPopup('cd-popup-transaction-1');
      return Promise.resolve();
    });

    try {
      render(<BnplLauncher />);

      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          'Failed to persist Credit Direct popup reference:',
          'Update failed'
        );
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('preserves trackingToken when redirecting after CredPal success', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credpal',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockOpenCredPalCheckout.mockImplementation(({ onSuccess }) => {
      onSuccess({ order_no: 'credpal-ref-1' });
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/order-success?orderId=order-1&reference=credpal-ref-1&type=credpal&trackingToken=track-order-token'
      );
    });
  });

  it('posts CredPal close events to the native WebView bridge', async () => {
    const postMessage = vi.fn();
    (window as TestReactNativeWebViewWindow).ReactNativeWebView = {
      postMessage,
    };
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credpal',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockOpenCredPalCheckout.mockImplementation(({ onClose }) => {
      onClose();
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        JSON.stringify({
          gateway: 'credpal',
          message: 'CredPal checkout closed',
          type: 'bnpl_close',
        })
      );
    });
    expect(screen.queryByText('Payment cancelled.')).not.toBeInTheDocument();
  });

  it('keeps the web CredPal cancellation fallback when no native bridge exists', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credpal',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockOpenCredPalCheckout.mockImplementation(({ onClose }) => {
      onClose();
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    expect(await screen.findByText('Payment cancelled.')).toBeInTheDocument();
  });

  it('keeps the web CredPal cancellation fallback when native close posting fails', async () => {
    (window as TestReactNativeWebViewWindow).ReactNativeWebView = {
      postMessage: vi.fn(() => {
        throw new Error('native bridge unavailable');
      }),
    };
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'credpal',
        merchant_slug: 'test-store',
        trackingToken: 'tok-123',
      })
    );
    mockOpenCredPalCheckout.mockImplementation(({ onClose }) => {
      onClose();
      return Promise.resolve();
    });

    render(<BnplLauncher />);

    expect(await screen.findByText('Payment cancelled.')).toBeInTheDocument();
  });

  it('launches Klump checkout with BAC reference and callback route', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          shipping_cost: 2726,
          total: 58088.5,
          customer_email: 'cu***@example.com',
          customer_phone: '+2**********78',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 51500,
              quantity: 1,
            },
          ],
        }),
      })
    );
    window.sessionStorage.setItem(
      CHECKOUT_PENDING_ORDER_STORAGE_KEY,
      JSON.stringify({
        orderId: 'order-1',
        trackingToken: 'tok-123',
        customerEmail: 'customer@example.com',
        customerPhone: '+234 0801 234 5678',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });
    expect(document.getElementById('klump__checkout')).toBeInTheDocument();

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      data: {
        amount: number;
        email: string;
        items: Array<{
          name: string;
          quantity: number;
          unit_price: number;
        }>;
        merchant_reference: string;
        phone: string;
        redirect_url: string;
      };
      onClose?: () => void;
      onLoad?: () => void;
      onSuccess?: () => void;
      publicKey: string;
    };

    expect(config.publicKey).toBe('klp_pk_test_123');
    expect(config.onLoad).toEqual(expect.any(Function));
    expect(config.onSuccess).toEqual(expect.any(Function));
    expect(config.data.amount).toBe(58089);
    expect(config.data.email).toBe('customer@example.com');
    expect(config.data.items).toEqual([
      { name: 'Capsule', quantity: 1, unit_price: 51500 },
      { name: 'Delivery', quantity: 1, unit_price: 2726 },
      { name: 'Taxes and fees', quantity: 1, unit_price: 3863 },
    ]);
    expect(config.data.merchant_reference).toBe('BAC-ABCD12345678');
    expect(config.data.phone).toBe('08012345678');
    expect(config.data.redirect_url).toContain('/checkout/bnpl?');
    expect(config.data.redirect_url).not.toContain('/test-store/checkout/bnpl?');
    expect(config.data.redirect_url).toContain('gateway=klump');
    expect(config.data.redirect_url).toContain('klump_callback=1');
    expect(config.data.redirect_url).toContain('reference=BAC-ABCD12345678');
    expect(config.data.redirect_url).toContain('type=klump');

    const klumpCheckoutFrame = document.createElement('iframe');
    klumpCheckoutFrame.id = 'klump_checkout';
    document.body.appendChild(klumpCheckoutFrame);
    config.onClose?.();
    await waitFor(() => {
      expect(
        screen.queryByText('Payment cancelled. Please try again.')
      ).not.toBeInTheDocument();
    });
  });

  it('shows a Klump invalid-total error without using the generic launch error path', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order-1',
          tracking_token: 'track-order-token',
          total: 'not-a-number',
          customer_email: 'customer@example.com',
          customer_phone: '08012345678',
          customer_name: 'John Doe',
          items: [
            {
              product_id: 'product-1',
              name: 'Capsule',
              price: 1000,
              quantity: 1,
            },
          ],
        }),
      })
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const appendScriptSpy = vi.spyOn(document.head, 'appendChild');
    window.Klump = undefined;

    try {
      render(<BnplLauncher />);

      expect(
        await screen.findByText('Invalid order total for Klump checkout.')
      ).toBeInTheDocument();
      expect(mockKlumpConstructor).not.toHaveBeenCalled();
      expect(appendScriptSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      appendScriptSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('does not mark Klump checkout cancelled when success redirect is pending', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      data: { redirect_url: string };
      onClose?: () => void;
      onSuccess?: () => void;
    };
    config.onSuccess?.();
    window.localStorage.setItem(KLUMP_REDIRECT_URL_KEY, config.data.redirect_url);
    config.onClose?.();

    await waitFor(() => {
      expect(
        screen.queryByText('Payment cancelled. Please try again.')
      ).not.toBeInTheDocument();
    });
  });

  it('does not mark Klump checkout cancelled when the SDK redirect key is pending', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      data: { redirect_url: string };
      onClose?: () => void;
    };
    window.localStorage.setItem(KLUMP_REDIRECT_URL_KEY, config.data.redirect_url);
    config.onClose?.();

    await waitFor(() => {
      expect(
        screen.queryByText('Payment cancelled. Please try again.')
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(window.localStorage.getItem(KLUMP_REDIRECT_URL_KEY)).toBeNull();
    });
  });

  it('bridges Klump close events to React Native without rendering cancellation UI', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'ReactNativeWebView', {
      configurable: true,
      value: { postMessage },
    });
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      onClose?: () => void;
    };
    config.onClose?.();

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        JSON.stringify({
          gateway: 'klump',
          message: 'Klump checkout closed',
          type: 'bnpl_close',
        })
      );
    });
    expect(
      screen.queryByText('Payment cancelled. Please try again.')
    ).not.toBeInTheDocument();
  });

  it('marks Klump checkout cancelled when the stored SDK redirect belongs to a previous checkout', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    window.localStorage.setItem(
      KLUMP_REDIRECT_URL_KEY,
      'https://ogabassey.com/checkout/bnpl?gateway=klump&orderId=old-order&klump_callback=1'
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      onClose?: () => void;
    };
    config.onClose?.();

    await waitFor(() => {
      expect(
        screen.getByText('Payment cancelled. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('clears a stale matching Klump redirect before a new checkout cancellation', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    const staleRedirectUrl =
      'http://localhost:3000/checkout/bnpl?gateway=klump&klump_callback=1&merchant_slug=test-store&orderId=order-1&reference=BAC-ABCD12345678&type=klump&trackingToken=tok-123';
    window.localStorage.setItem(KLUMP_REDIRECT_URL_KEY, staleRedirectUrl);

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });

    const config = mockKlumpConstructor.mock.calls[0][0] as {
      onClose?: () => void;
    };
    config.onClose?.();

    await waitFor(() => {
      expect(
        screen.getByText('Payment cancelled. Please try again.')
      ).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(KLUMP_REDIRECT_URL_KEY)).toBeNull();
  });

  it('uses the Klump global binding when the SDK does not attach itself to window', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    window.Klump = undefined;
    vi.stubGlobal('Klump', mockKlumpConstructor);

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockKlumpConstructor).toHaveBeenCalled();
    });
  });

  it('shows an error when the Klump SDK script fails to load', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    vi.stubGlobal('Klump', undefined);
    window.Klump = undefined;

    const originalAppendChild = document.head.appendChild.bind(document.head);
    const appendSpy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation(<T extends Node>(node: T): T => {
        const result = originalAppendChild(node);
        if (
          node instanceof HTMLScriptElement &&
          node.src === 'https://js.useklump.com/klump.js'
        ) {
          queueMicrotask(() => node.dispatchEvent(new Event('error')));
        }
        return result;
      });

    try {
      render(<BnplLauncher />);

      expect(
        await screen.findByRole('heading', { name: 'Something went wrong' })
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Failed to load Klump script')
      ).toBeInTheDocument();
      expect(appendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          src: 'https://js.useklump.com/klump.js',
        })
      );
    } finally {
      appendSpy.mockRestore();
    }
  });

  it('loads the Klump SDK script when no constructor is available yet', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
      })
    );
    vi.stubEnv('NEXT_PUBLIC_KLUMP_PUBLIC_KEY', 'klp_pk_test_123');
    vi.stubGlobal('Klump', undefined);
    window.Klump = undefined;

    const originalAppendChild = document.head.appendChild.bind(document.head);
    const appendSpy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation(<T extends Node>(node: T): T => {
        const result = originalAppendChild(node);
        if (
          node instanceof HTMLScriptElement &&
          node.src === 'https://js.useklump.com/klump.js'
        ) {
          window.Klump = mockKlumpConstructor as never;
          node.dispatchEvent(new Event('load'));
        }
        return result;
      });

    try {
      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockKlumpConstructor).toHaveBeenCalled();
      });
      expect(appendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          src: 'https://js.useklump.com/klump.js',
        })
      );
    } finally {
      appendSpy.mockRestore();
    }
  });

  it('records Klump callback transaction ids before redirecting to success', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-1',
        gateway: 'klump',
        merchant_slug: 'test-store',
        reference: 'BAC-ABCD12345678',
        trackingToken: 'tok-123',
        klump_callback: '1',
        transaction_id: 'klump-txn-123',
      })
    );

    render(<BnplLauncher />);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/payments/klump/record', {
        merchant_reference: 'BAC-ABCD12345678',
        klump_transaction_id: 'klump-txn-123',
        tracking_token: 'tok-123',
      });
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/order-success?orderId=order-1&reference=BAC-ABCD12345678&type=klump&trackingToken=tok-123'
    );
  });

  it('shows an error state and does not redirect when order fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Tracking token or email is required',
      })
    );

    const { findByRole, findByText } = render(<BnplLauncher />);

    expect(
      await findByRole('heading', { name: 'Something went wrong' })
    ).toBeInTheDocument();
    expect(
      await findByText('Failed to fetch order details (Status: 400)')
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  describe('Credit Direct popup return verification', () => {
    function seedPopupMarker(orderId: string, transactionId: string) {
      window.sessionStorage.setItem(
        `${CREDIT_DIRECT_POPUP_MARKER_PREFIX}${orderId}`,
        JSON.stringify({
          transactionId,
          storedAt: '2026-07-06T12:29:45.000Z',
        })
      );
    }

    function stubOrderStatusFetch(paymentStatus: string | null) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            id: 'order-1',
            payment_status: paymentStatus,
            total: 1000,
            items: [
              {
                product_id: 'product-1',
                name: 'Capsule',
                price: 1000,
                quantity: 1,
              },
            ],
          }),
        })
      );
    }

    it('verifies the order instead of relaunching checkout when a popup marker exists', async () => {
      seedPopupMarker('order-1', 'txn-123');
      stubOrderStatusFetch('bnpl_approved');

      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/order-success?orderId=order-1&reference=txn-123&type=credit_direct&trackingToken=tok-123'
        );
      });
      expect(mockOpenCreditDirectCheckout).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-1?merchant_slug=test-store&token=tok-123',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(readCreditDirectPopupMarker('order-1')).toBeNull();
    });

    it('shows the confirming state while the payment is still pending', async () => {
      seedPopupMarker('order-1', 'txn-123');
      stubOrderStatusFetch('bnpl_pending');

      render(<BnplLauncher />);

      expect(
        await screen.findByRole('heading', { name: 'Confirming your payment' })
      ).toBeInTheDocument();
      expect(mockOpenCreditDirectCheckout).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows the cancelled state and clears the marker for a cancelled order', async () => {
      seedPopupMarker('order-1', 'txn-123');
      stubOrderStatusFetch('cancelled');

      render(<BnplLauncher />);

      expect(
        await screen.findByRole('heading', { name: 'Order cancelled' })
      ).toBeInTheDocument();
      expect(mockOpenCreditDirectCheckout).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(readCreditDirectPopupMarker('order-1')).toBeNull();
      });
    });

    it('writes a popup marker when the Credit Direct SDK opens its popup', async () => {
      let capturedOnPopup:
        | ((transactionId: string) => Promise<void>)
        | undefined;
      mockOpenCreditDirectCheckout.mockImplementation(({ onPopup }) => {
        capturedOnPopup = onPopup;
        return Promise.resolve();
      });

      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockOpenCreditDirectCheckout).toHaveBeenCalled();
      });
      await capturedOnPopup?.('txn-999');

      expect(readCreditDirectPopupMarker('order-1')?.transactionId).toBe(
        'txn-999'
      );
    });

    it('clears the popup marker after an in-page success callback', async () => {
      mockOpenCreditDirectCheckout.mockImplementation(
        async ({ onPopup, onSuccess }) => {
          await onPopup('txn-999');
          onSuccess('txn-999');
        }
      );

      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/order-success?orderId=order-1&reference=txn-999&type=credit_direct&trackingToken=track-order-token'
        );
      });
      expect(readCreditDirectPopupMarker('order-1')).toBeNull();
    });

    it('relaunches checkout after starting a new attempt on a verification timeout', async () => {
      vi.useFakeTimers();
      try {
        seedPopupMarker('order-1', 'txn-123');
        stubOrderStatusFetch('bnpl_pending');

        render(<BnplLauncher />);
        await act(async () => {});
        await act(async () => {
          await vi.advanceTimersByTimeAsync(151_000);
        });
      } finally {
        vi.useRealTimers();
      }

      fireEvent.click(
        screen.getByRole('button', { name: 'Start a new payment attempt' })
      );

      await waitFor(() => {
        expect(mockOpenCreditDirectCheckout).toHaveBeenCalled();
      });
      expect(readCreditDirectPopupMarker('order-1')).toBeNull();
    });

    it('includes the lookup email on the verified success redirect when no tracking token exists', async () => {
      mockSearchParams.mockReturnValue(
        new URLSearchParams({
          orderId: 'order-1',
          gateway: 'credit_direct',
          merchant_slug: 'test-store',
          email: 'customer@example.com',
        })
      );
      seedPopupMarker('order-1', 'txn-123');
      stubOrderStatusFetch('bnpl_approved');

      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/order-success?orderId=order-1&reference=txn-123&type=credit_direct&email=customer%40example.com'
        );
      });
    });

    it('returns to the storefront home from the verification view on slug-prefixed launchers', async () => {
      vi.useFakeTimers();
      try {
        window.history.replaceState({}, '', '/test-store/checkout/bnpl');
        seedPopupMarker('order-1', 'txn-123');
        stubOrderStatusFetch('bnpl_pending');

        render(<BnplLauncher />);
        await act(async () => {});
        await act(async () => {
          await vi.advanceTimersByTimeAsync(151_000);
        });
      } finally {
        vi.useRealTimers();
      }

      fireEvent.click(screen.getByRole('button', { name: 'Return to Home' }));

      expect(mockPush).toHaveBeenCalledWith('/test-store');
    });

    it('keeps the storefront slug prefix on the verified success redirect', async () => {
      window.history.replaceState({}, '', '/test-store/checkout/bnpl');
      seedPopupMarker('order-1', 'txn-123');
      stubOrderStatusFetch('bnpl_approved');

      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/test-store/order-success?orderId=order-1&reference=txn-123&type=credit_direct&trackingToken=tok-123'
        );
      });
    });

    // Regression test for the marker-adoption/error race: onPopup stores the
    // popup marker, then a bfcache restore adopts it into React state before
    // onError fires. The error/retry view must replace payment verification.
    it('clears a stale popup marker when the SDK reports an error', async () => {
      let onPopup: ((transactionId: string) => Promise<void>) | undefined;
      let onError: ((error: string) => void) | undefined;
      mockOpenCreditDirectCheckout.mockImplementation((options) => {
        onPopup = options.onPopup;
        onError = options.onError;
        return Promise.resolve();
      });

      render(<BnplLauncher />);

      await waitFor(() => {
        expect(mockOpenCreditDirectCheckout).toHaveBeenCalledOnce();
      });
      await act(async () => {
        await onPopup?.('txn-999');
      });
      const pageShowEvent = new Event('pageshow');
      Object.defineProperty(pageShowEvent, 'persisted', { value: true });
      act(() => window.dispatchEvent(pageShowEvent));

      expect(
        await screen.findByRole('heading', {
          name: 'Confirming your payment',
        })
      ).toBeInTheDocument();

      act(() => onError?.('SDK failed to open'));

      expect(
        await screen.findByRole(
          'heading',
          { name: 'Something went wrong' },
          { timeout: 5000 }
        )
      ).toBeInTheDocument();
      expect(readCreditDirectPopupMarker('order-1')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      expect(readCreditDirectPopupMarker('order-1')).toBeNull();
    });

    it('launches a new order after the previous launcher URL errors', async () => {
      mockOpenCreditDirectCheckout.mockImplementationOnce(({ onError }) => {
        onError('SDK failed to open');
        return Promise.resolve();
      });
      mockOpenCreditDirectCheckout.mockResolvedValueOnce(undefined);

      const { rerender } = render(<BnplLauncher />);

      expect(
        await screen.findByRole('heading', { name: 'Something went wrong' })
      ).toBeInTheDocument();

      mockSearchParams.mockReturnValue(
        new URLSearchParams({
          orderId: 'order-2',
          gateway: 'credit_direct',
          merchant_slug: 'test-store',
          trackingToken: 'tok-456',
        })
      );
      rerender(<BnplLauncher />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/storefront/orders/order-2?merchant_slug=test-store&token=tok-456'
        );
      });
      expect(mockOpenCreditDirectCheckout).toHaveBeenCalledTimes(2);
    });
  });
});
