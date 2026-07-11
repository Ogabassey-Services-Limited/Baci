import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPaypalReturnUrls,
  capturePaypalReturn,
  clearPaypalPendingContext,
  readPaypalPendingContext,
  startPaypalCheckout,
  writePaypalPendingContext,
} from './paypal-checkout-client';

const mockFetch = vi.fn();

describe('paypal-checkout-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    window.sessionStorage.clear();
    // jsdom lets us assign location.href; capture assignments for assertions.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://store.example.com/checkout?step=payment',
        search: '',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('pending context round-trip', () => {
    it('writes, reads and clears a valid context', () => {
      writePaypalPendingContext({
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        merchantId: 'merchant-1',
        trackingToken: 'trk-1',
      });

      expect(readPaypalPendingContext()).toEqual({
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        merchantId: 'merchant-1',
        trackingToken: 'trk-1',
      });

      clearPaypalPendingContext();
      expect(readPaypalPendingContext()).toBeNull();
    });

    it('returns null for a malformed stored context', () => {
      window.sessionStorage.setItem(
        'baci:paypal-pending-context',
        JSON.stringify({ orderId: 'order-1' })
      );
      expect(readPaypalPendingContext()).toBeNull();
    });
  });

  describe('buildPaypalReturnUrls', () => {
    it('adds disambiguating markers to the same-origin checkout URL', () => {
      const { returnUrl, cancelUrl } = buildPaypalReturnUrls(
        'https://store.example.com/checkout?step=payment'
      );

      expect(returnUrl).toContain('paypal_return=1');
      expect(returnUrl).not.toContain('paypal_cancel');
      expect(cancelUrl).toContain('paypal_cancel=1');
      expect(cancelUrl).not.toContain('paypal_return');
    });

    it('strips a stale token, PayerID and markers from a retry href', () => {
      // Arrange: a href left behind by a cancelled/failed prior attempt.
      const staleHref =
        'https://store.example.com/checkout?step=payment&paypal_cancel=1&token=PP-STALE&PayerID=OLD-PAYER';

      // Act
      const { returnUrl, cancelUrl } = buildPaypalReturnUrls(staleHref);

      // Assert: no PayPal-owned param from the prior attempt survives, and the
      // preserved app param (step) is untouched so PayPal appends a clean token.
      const ret = new URL(returnUrl);
      expect(ret.searchParams.getAll('token')).toEqual([]);
      expect(ret.searchParams.get('PayerID')).toBeNull();
      expect(ret.searchParams.get('paypal_return')).toBe('1');
      expect(ret.searchParams.has('paypal_cancel')).toBe(false);
      expect(ret.searchParams.get('step')).toBe('payment');

      const cancel = new URL(cancelUrl);
      expect(cancel.searchParams.getAll('token')).toEqual([]);
      expect(cancel.searchParams.get('PayerID')).toBeNull();
      expect(cancel.searchParams.get('paypal_cancel')).toBe('1');
      expect(cancel.searchParams.has('paypal_return')).toBe(false);
    });
  });

  describe('startPaypalCheckout', () => {
    it('creates the order and redirects to the approval url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'PP-1', approveUrl: 'https://paypal.test/x' }),
      });

      await startPaypalCheckout({
        merchantId: 'merchant-1',
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        trackingToken: 'trk-1',
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/payments/paypal/create-order');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        order_id: 'order-1',
        customer_email: 'buyer@example.com',
        merchant_id: 'merchant-1',
      });
      expect(body.return_url).toContain('paypal_return=1');
      expect(window.location.href).toBe('https://paypal.test/x');
      expect(readPaypalPendingContext()?.orderId).toBe('order-1');
    });

    it('does not carry a stale token/PayerID into retry return and cancel urls', async () => {
      // Arrange: buyer is retrying from a URL that still has the previous
      // attempt's cancel marker + PayPal token/PayerID.
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          href: 'https://store.example.com/checkout?step=payment&paypal_cancel=1&token=PP-STALE&PayerID=OLD-PAYER',
          search: '',
        },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'PP-2', approveUrl: 'https://paypal.test/y' }),
      });

      // Act
      await startPaypalCheckout({
        merchantId: 'merchant-1',
        orderId: 'order-2',
        customerEmail: 'buyer@example.com',
      });

      // Assert: the URLs handed to PayPal are free of the stale values.
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.return_url).not.toContain('PP-STALE');
      expect(body.return_url).not.toContain('PayerID');
      expect(body.return_url).toContain('paypal_return=1');
      expect(body.cancel_url).not.toContain('PP-STALE');
      expect(body.cancel_url).not.toContain('PayerID');
      expect(body.cancel_url).toContain('paypal_cancel=1');
    });

    it('clears context and throws when create-order fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Live exchange rate unavailable' }),
      });

      await expect(
        startPaypalCheckout({
          merchantId: 'merchant-1',
          orderId: 'order-1',
          customerEmail: 'buyer@example.com',
        })
      ).rejects.toThrow('Live exchange rate unavailable');
      expect(readPaypalPendingContext()).toBeNull();
    });

    it('clears context and throws when no approval url is returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'PP-1', reused: true }),
      });

      await expect(
        startPaypalCheckout({
          merchantId: 'merchant-1',
          orderId: 'order-1',
          customerEmail: 'buyer@example.com',
        })
      ).rejects.toThrow(/approval link/i);
      expect(readPaypalPendingContext()).toBeNull();
    });
  });

  describe('capturePaypalReturn', () => {
    it('is a noop when the search has no PayPal markers', async () => {
      const result = await capturePaypalReturn('?step=payment', 'merchant-1');
      expect(result).toEqual({ status: 'noop' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports cancellation and clears context on paypal_cancel', async () => {
      writePaypalPendingContext({
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        merchantId: 'merchant-1',
      });

      const result = await capturePaypalReturn(
        '?paypal_cancel=1',
        'merchant-1'
      );
      expect(result).toEqual({ status: 'cancelled' });
      expect(readPaypalPendingContext()).toBeNull();
    });

    it('captures using the stored context and the token query param', async () => {
      writePaypalPendingContext({
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        merchantId: 'merchant-1',
        trackingToken: 'trk-1',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await capturePaypalReturn(
        '?paypal_return=1&token=PP-1&PayerID=abc',
        'merchant-1'
      );

      expect(result).toEqual({
        status: 'captured',
        orderId: 'order-1',
        trackingToken: 'trk-1',
      });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/payments/paypal/capture-order');
      expect(JSON.parse(init.body)).toMatchObject({
        order_id: 'order-1',
        paypal_order_id: 'PP-1',
        merchant_id: 'merchant-1',
      });
      expect(readPaypalPendingContext()).toBeNull();
    });

    it('errors when the return context is missing', async () => {
      const result = await capturePaypalReturn(
        '?paypal_return=1&token=PP-1',
        'merchant-1'
      );
      expect(result.status).toBe('error');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not act on a context belonging to a different merchant', async () => {
      writePaypalPendingContext({
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        merchantId: 'other-merchant',
      });

      const result = await capturePaypalReturn(
        '?paypal_return=1&token=PP-1',
        'merchant-1'
      );
      expect(result).toEqual({ status: 'noop' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('surfaces a capture failure without clearing context', async () => {
      writePaypalPendingContext({
        orderId: 'order-1',
        customerEmail: 'buyer@example.com',
        merchantId: 'merchant-1',
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'PayPal environment mismatch' }),
      });

      const result = await capturePaypalReturn(
        '?paypal_return=1&token=PP-1',
        'merchant-1'
      );
      expect(result).toMatchObject({
        status: 'error',
        message: 'PayPal environment mismatch',
        orderId: 'order-1',
      });
    });
  });
});
