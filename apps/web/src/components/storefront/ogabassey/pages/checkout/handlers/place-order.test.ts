import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePlaceOrder } from './place-order';
import type { PlaceOrderOptions } from './place-order';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/credpal', () => ({
  openCredPalCheckout: vi.fn(),
}));

vi.mock('@/lib/credit-direct-client', () => ({
  openCreditDirectCheckout: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('handlePlaceOrder', () => {
  const buildOpts = (
    overrides: Partial<PlaceOrderOptions> = {},
  ): PlaceOrderOptions => ({
    merchant: { id: 'merchant-1', slug: 'test-store' },
    customerEmail: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    customerPhone: '+2348012345678',
    deliveryMethod: 'door',
    isNewAddressMode: true,
    newAddressStreet: '123 Test St',
    newAddressCity: 'Ikeja',
    newAddressState: 'Lagos',
    selectedAddressId: 0,
    addresses: [],
    airportType: 'delivery',
    cart: [
      {
        id: 'p1',
        name: 'Product 1',
        quantity: 2,
        price: 5000,
      },
    ],
    cartTotal: 10000,
    deliveryCost: 2000,
    total: 12000,
    selectedQuoteId: 'q1',
    shippingQuotes: [
      {
        id: 'q1',
        provider: 'gigl',
        serviceTier: 'standard',
        carrierName: 'GIG Logistics',
        displayName: 'Standard',
        price: 2000,
        estimatedDays: 3,
        currency: 'NGN',
      },
    ],
    paymentMethod: 'invoice',
    payWithWallet: false,
    walletAmountUsed: 0,
    createAccount: false,
    accountPassword: '',
    newsletterOptIn: false,
    user: null,
    payForMeDetails: { name: '', contact: '', note: '' },
    resumedOrder: null,
    preferredGateway: null,
    isOrderInFlightRef: { current: false },
    setIsProcessing: vi.fn(),
    setWalletBalance: vi.fn(),
    setCurrentStep: vi.fn(),
    setCompletedSteps: vi.fn(),
    clearCheckoutSession: vi.fn(),
    clearCart: vi.fn(),
    routerPush: vi.fn(),
    getHref: vi.fn((path: string) => `/test-store${path}`),
    executeDirectPayment: vi.fn(),
    crypto: {
      setPendingCryptoOrder: vi.fn(),
      setShowCryptoSelector: vi.fn(),
      setCryptoPaymentData: vi.fn(),
    },
    dva: {
      handleBankTransfer: vi.fn(),
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Validation', () => {
    it('returns early on double-submit', async () => {
      const opts = buildOpts({
        isOrderInFlightRef: { current: true },
      });
      await handlePlaceOrder(opts);
      expect(opts.setIsProcessing).not.toHaveBeenCalled();
    });

    it('shows error toast when merchant is missing', async () => {
      const { toast } = await import('@/hooks/use-toast');
      const opts = buildOpts({ merchant: null });
      await handlePlaceOrder(opts);
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error' }),
      );
      expect(opts.isOrderInFlightRef.current).toBe(false);
    });

    it('shows error toast when name/email is missing', async () => {
      const { toast } = await import('@/hooks/use-toast');
      const opts = buildOpts({ firstName: '' });
      await handlePlaceOrder(opts);
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Missing Information' }),
      );
    });

    it('shows error toast for incomplete door delivery address', async () => {
      const { toast } = await import('@/hooks/use-toast');
      const opts = buildOpts({ newAddressStreet: '' });
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      await handlePlaceOrder(opts);
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Incomplete Address' }),
      );
    });

    // B3 review fix #2 (PR #1611): door delivery without ANY quote
    // must NOT submit. Pre-fix the handler sent `shipping_provider:
    // null + selected_quote_id: null`, which slipped past the RPC's
    // `provider != null AND quote_id IS NULL` guard (both null →
    // guard doesn't fire) and silently persisted a zero-shipping
    // order. The RPC predicate alone can't tell legitimate pickup
    // (no provider, no quote) from broken door-no-quote — the client
    // is the right place to enforce.
    it('shows error toast when door delivery has no selected quote at all', async () => {
      const { toast } = await import('@/hooks/use-toast');
      const opts = buildOpts({
        deliveryMethod: 'door',
        selectedQuoteId: '', // pristine: user never picked a quote
        shippingQuotes: [
          {
            id: 'q-fresh',
            provider: 'gigl',
            serviceTier: 'standard',
            carrierName: 'GIG Logistics',
            displayName: 'Standard',
            price: 2000,
            estimatedDays: 3,
            currency: 'NGN',
          },
        ],
      });
      await handlePlaceOrder(opts);

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delivery option required' }),
      );
      // Critical: the order never reaches /api/orders. Pre-fix it would
      // have POSTed `shipping_provider: null + selected_quote_id: null`
      // and got back a silent 200 with zero shipping fee attached.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(opts.isOrderInFlightRef.current).toBe(false);
      expect(opts.setIsProcessing).toHaveBeenCalledWith(false);
    });

    // B3 review fix #1 (PR #1611): door delivery with a selectedQuoteId
    // that no longer exists in `shippingQuotes` (rates refreshed or
    // expired) must NOT fabricate a 'Standard' provider — the order
    // would persist with a phony provider and dangling quote id,
    // sneaking past the new RPC guard. The handler bails with a
    // validation toast so the customer re-picks from fresh rates.
    it('shows error toast when door delivery references a quote id that no longer resolves', async () => {
      const { toast } = await import('@/hooks/use-toast');
      const opts = buildOpts({
        deliveryMethod: 'door',
        selectedQuoteId: 'q-expired-and-refreshed',
        // Quote list has a different id (e.g. user reopened the
        // tab and rates were re-fetched, but the stored
        // selectedQuoteId in their session is stale).
        shippingQuotes: [
          {
            id: 'q-fresh',
            provider: 'gigl',
            serviceTier: 'standard',
            carrierName: 'GIG Logistics',
            displayName: 'Standard',
            price: 2000,
            estimatedDays: 3,
            currency: 'NGN',
          },
        ],
      });
      await handlePlaceOrder(opts);

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Shipping rate expired' }),
      );
      expect(mockFetch).not.toHaveBeenCalled();
      expect(opts.isOrderInFlightRef.current).toBe(false);
      expect(opts.setIsProcessing).toHaveBeenCalledWith(false);
    });
  });

  describe('Resumed Order Flow', () => {
    it('delegates to executeDirectPayment for resumed orders', async () => {
      const opts = buildOpts({
        resumedOrder: {
          id: 'order-1',
          short_id: 'ORD-1',
          subtotal: 10000,
          shipping_cost: 2000,
          total: 12000,
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          customer_phone: '+2348012345678',
          shipping_address: {
            address: '123 St',
            city: 'Ikeja',
            state: 'Lagos',
            phone: '+2348012345678',
          },
          items: [],
        },
        preferredGateway: 'credpal',
      });
      await handlePlaceOrder(opts);
      expect(opts.executeDirectPayment).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Order Creation', () => {
    it('creates an order via POST /api/orders', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'new-order-1' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts();
      await handlePlaceOrder(opts);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/orders',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes variantId and variantAttributes in order items', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-variant' },
          wallet: null,
          amountDueToGateway: 720000,
        }),
      });

      const opts = buildOpts({
        cart: [
          {
            id: 'p-variant',
            name: 'MacBook Air M1',
            quantity: 1,
            price: 720000,
            variantId: 'variant-256gb',
            variantAttributes: { storage: '256GB', color: 'Space Gray' },
            hasAssurance: false,
          },
        ],
        cartTotal: 720000,
        total: 720000,
      });
      await handlePlaceOrder(opts);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.items[0]).toEqual(
        expect.objectContaining({
          variantId: 'variant-256gb',
          variantAttributes: { storage: '256GB', color: 'Space Gray' },
        }),
      );
    });

    it('throws on failed order creation', async () => {
      const { toast } = await import('@/hooks/use-toast');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      const opts = buildOpts();
      await handlePlaceOrder(opts);

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Checkout Failed' }),
      );
      expect(opts.setIsProcessing).toHaveBeenCalledWith(false);
    });
  });

  describe('Invoice Payment', () => {
    it('redirects to order-success for invoice payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-inv' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({ paymentMethod: 'invoice' });
      await handlePlaceOrder(opts);

      expect(opts.clearCheckoutSession).toHaveBeenCalled();
      expect(opts.routerPush).toHaveBeenCalled();
      expect(opts.getHref).toHaveBeenCalledWith(
        '/order-success?type=invoice&orderId=order-inv',
      );
    });
  });

  describe('Wallet Covers Total', () => {
    it('redirects with wallet=true when amountDueToGateway is 0', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-w' },
          wallet: { amountUsed: 12000, newBalance: 5000 },
          amountDueToGateway: 0,
        }),
      });

      const opts = buildOpts({
        payWithWallet: true,
        walletAmountUsed: 12000,
      });
      await handlePlaceOrder(opts);

      expect(opts.setWalletBalance).toHaveBeenCalledWith(5000);
      expect(opts.getHref).toHaveBeenCalledWith(
        '/order-success?orderId=order-w&wallet=true',
      );
    });
  });

  describe('Bank Transfer', () => {
    it('delegates to DVA handler for bank_transfer', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-bt' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({ paymentMethod: 'bank_transfer' });
      await handlePlaceOrder(opts);

      expect(opts.dva.handleBankTransfer).toHaveBeenCalledWith(
        { id: 'order-bt' },
        12000,
        opts.isOrderInFlightRef,
        opts.setIsProcessing,
      );
    });
  });

  describe('Crypto (Juicyway)', () => {
    it('opens crypto selector for juicyway payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-crypto' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({ paymentMethod: 'juicyway' });
      await handlePlaceOrder(opts);

      expect(opts.crypto.setPendingCryptoOrder).toHaveBeenCalled();
      expect(opts.crypto.setShowCryptoSelector).toHaveBeenCalledWith(true);
      expect(opts.setIsProcessing).toHaveBeenCalledWith(false);
    });
  });

  describe('PayForMe', () => {
    it('redirects with payer name for payforme payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-pfm' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({
        paymentMethod: 'payforme',
        payForMeDetails: {
          name: 'Jane Doe',
          contact: 'jane@example.com',
          note: 'Please pay for me',
        },
      });
      await handlePlaceOrder(opts);

      expect(opts.getHref).toHaveBeenCalledWith(
        expect.stringContaining('type=payforme'),
      );
      expect(opts.getHref).toHaveBeenCalledWith(
        expect.stringContaining('payerName=Jane%20Doe'),
      );
    });
  });

  describe('Shipping Address Building', () => {
    it('uses saved address when not in new address mode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-sa' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({
        paymentMethod: 'invoice',
        isNewAddressMode: false,
        selectedAddressId: 1,
        addresses: [
          {
            id: 1,
            label: 'Home',
            address: '5 Allen Ave, Ikeja, Lagos',
            phone: '+2348012345678',
            isDefault: true,
          },
        ],
      });
      await handlePlaceOrder(opts);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.shipping_address.address).toBe(
        '5 Allen Ave, Ikeja, Lagos',
      );
    });

    it('uses pickup address for pickup delivery', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-pk' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({
        paymentMethod: 'invoice',
        deliveryMethod: 'pickup',
      });
      await handlePlaceOrder(opts);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.shipping_address.address).toBe('Pickup at Store');
      // B3 (plan §5 B3): pickup is a delivery-method label, not a
      // third-party shipping provider. Sending 'Pickup' would trip the
      // RPC's `shipping_quote_required` guard. The handler now sends
      // `shipping_provider: null` for pickup; the delivery method is
      // carried by `shipping_address.address: 'Pickup at Store'`.
      expect(fetchBody.shipping_provider).toBeNull();
    });

    it('omits shipping_provider for airport delivery (B3 — delivery-method labels are not providers)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-ap' },
          wallet: null,
          amountDueToGateway: 5000,
        }),
      });

      const opts = buildOpts({
        paymentMethod: 'invoice',
        deliveryMethod: 'airport',
      });
      await handlePlaceOrder(opts);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.shipping_provider).toBeNull();
    });
  });

  describe('Account Creation', () => {
    it('attempts signup when createAccount is true and no user', async () => {
      const { createClient } = await import('@/lib/supabase/client');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { id: 'order-acc' },
          wallet: null,
          amountDueToGateway: 12000,
        }),
      });

      const opts = buildOpts({
        paymentMethod: 'invoice',
        createAccount: true,
        accountPassword: 'securepass123',
      });
      await handlePlaceOrder(opts);

      expect(createClient).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('resets state on checkout error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const opts = buildOpts();
      await handlePlaceOrder(opts);

      expect(opts.setIsProcessing).toHaveBeenCalledWith(false);
      expect(opts.isOrderInFlightRef.current).toBe(false);
      expect(opts.setCurrentStep).toHaveBeenCalledWith('payment');
      expect(opts.setCompletedSteps).toHaveBeenCalledWith({
        contact: true,
        delivery: true,
      });
    });
  });
});
