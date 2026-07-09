import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addressAutocompleteMock = vi.hoisted(() => ({
  selectedPlace: null as null | {
    city: string;
    formattedAddress: string;
    location: { latitude: number; longitude: number };
    state: string;
  },
}));

// Mock all heavy dependencies before importing the component
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('@/lib/feature-flags', () => ({
  hasPriceNegotiationEntitlement: vi.fn(() => true),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    cart: [],
    cartTotal: 0,
    clearCart: vi.fn(),
    isHydrated: true,
  })),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: {
      id: 'merchant-1',
      slug: 'test-store',
      business_name: 'Test Store',
      vat_registration_status: 'registered',
      vat_rate: 7.5,
      country: 'NG',
    },
    basePath: '/test-store',
  })),
}));

vi.mock('@/hooks/use-persisted-state', () => ({
  usePersistedForm: vi.fn(() => ({
    values: {
      firstName: '',
      lastName: '',
      customerEmail: '',
      customerPhone: '',
      newAddressStreet: '',
      newAddressState: '',
      newAddressCity: '',
      currentStep: 'contact',
      completedSteps: { contact: false, delivery: false },
    },
    setValue: vi.fn(),
    setValues: vi.fn(),
    clear: vi.fn(),
  })),
  usePersistedState: vi.fn(() => [null, vi.fn(), vi.fn()]),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuthSafe: vi.fn(() => null),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
  calculateCommerce: vi.fn().mockResolvedValue({
    total: 10000,
    taxAmount: 750,
  }),
}));

vi.mock('@/components/ui/phone-input', () => ({
  PhoneInput: vi.fn(({ value, onChange, ...props }) => (
    <input
      data-testid="phone-input"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  )),
}));

vi.mock('@/components/storefront/checkout-auth-modal', () => ({
  CheckoutAuthModal: vi.fn(() => null),
}));

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: vi.fn(
    ({ value, onChange, onChangeText, onSelect, ...props }) => (
      <>
        <input
          data-testid="address-input"
          value={value || ''}
          onChange={(e) => {
            onChange?.(e);
            onChangeText?.(e.target.value);
          }}
          {...props}
        />
        {addressAutocompleteMock.selectedPlace && (
          <button
            data-testid="select-address-place"
            type="button"
            onClick={() => onSelect?.(addressAutocompleteMock.selectedPlace)}
          >
            Select address place
          </button>
        )}
      </>
    ),
  ),
}));

vi.mock('@/lib/credpal', () => ({
  getCredPalKey: vi.fn(() => 'pk_test_credpal'),
  openCredPalCheckout: vi.fn(),
}));

vi.mock('@/lib/credit-direct-client', () => ({
  openCreditDirectCheckout: vi.fn(),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((path: string) => path),
}));

vi.mock('react-phone-number-input', () => ({
  isValidPhoneNumber: vi.fn(() => true),
}));

vi.mock('../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => null),
}));

vi.mock('../components/PaymentLogos', () => ({
  PaystackLogo: vi.fn(() => null),
  KorapayLogo: vi.fn(() => null),
  CredPalLogo: vi.fn(() => null),
  CreditDirectLogo: vi.fn(() => null),
  JuicywayLogo: vi.fn(() => null),
  BankTransferLogo: vi.fn(() => null),
}));

vi.mock('../components/MobileCheckoutComponents', () => ({
  MobileOrderSummary: vi.fn(() => null),
}));

import { hasPriceNegotiationEntitlement } from '@/lib/feature-flags';
import { CheckoutPage } from './checkout-page';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { toast } from '@/hooks/use-toast';
import { openCreditDirectCheckout } from '@/lib/credit-direct-client';
import { openCredPalCheckout } from '@/lib/credpal';
import { useAuthSafe } from '@/contexts/auth-context';
import {
  usePersistedForm,
  usePersistedState,
} from '@/hooks/use-persisted-state';
import { CHECKOUT_IDEMPOTENCY_STORAGE_KEY } from './checkout/checkout-idempotency';

function mockCheckoutSubmissionState() {
  vi.mocked(useCart).mockReturnValue({
    cart: [
      {
        id: 'item-1',
        name: 'Test Product',
        price: 5000,
        quantity: 1,
        image: '',
        slug: 'test-product',
      },
    ],
    cartTotal: 5000,
    clearCart: vi.fn(),
    isHydrated: true,
  } as unknown as ReturnType<typeof useCart>);
  vi.mocked(useMerchantSafe).mockReturnValue({
    merchant: {
      id: 'merchant-1',
      slug: 'test-store',
      business_name: 'Test Store',
      vat_registration_status: 'registered',
      vat_rate: 7.5,
      country: 'NG',
      feature_settings: {
        pay_on_delivery_enabled: true,
      },
    },
    basePath: '/test-store',
  } as unknown as ReturnType<typeof useMerchantSafe>);
  vi.mocked(usePersistedForm).mockReturnValue({
    values: {
      firstName: 'Ada',
      lastName: 'Buyer',
      customerEmail: 'ada@example.com',
      customerPhone: '+2348123456789',
      newAddressStreet: '2 Olaide Tomori Street',
      newAddressState: 'Lagos',
      newAddressCity: 'Ikeja',
      currentStep: 'delivery',
      completedSteps: { contact: true, delivery: false },
    },
    setValue: vi.fn(),
    setValues: vi.fn(),
    clear: vi.fn(),
  } as unknown as ReturnType<typeof usePersistedForm>);
}

async function submitPickupPayOnDeliveryOrder() {
  render(<CheckoutPage />);

  fireEvent.click(screen.getByRole('button', { name: /store pickup/i }));
  fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
  fireEvent.click(await screen.findByText(/pay on delivery/i));
  const placeOrderButton = screen
    .getAllByRole('button', { name: /place order/i })
    .find((button) => !button.hasAttribute('disabled'));
  expect(placeOrderButton).toBeDefined();
  fireEvent.click(placeOrderButton as HTMLButtonElement);
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addressAutocompleteMock.selectedPlace = null;
    vi.mocked(useCart).mockReturnValue({
      cart: [],
      cartTotal: 0,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>
    );
    vi.mocked(useAuthSafe).mockReturnValue(
      null as unknown as ReturnType<typeof useAuthSafe>
    );
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(usePersistedState).mockReturnValue(
      [null, vi.fn(), vi.fn()] as unknown as ReturnType<typeof usePersistedState>
    );
  });

  it('renders without crashing', () => {
    render(<CheckoutPage />);
    // The checkout page should render some form of checkout UI
    // With an empty cart, it redirects or shows empty state
    expect(document.body).toBeTruthy();
  });

  it('wraps the normal checkout state in the OgaBassey checkout scope', async () => {
    mockCheckoutSubmissionState();

    render(<CheckoutPage />);

    const checkoutMarkers = await screen.findAllByText(/secure checkout/i);

    expect(
      checkoutMarkers.some((node) =>
        node.closest('.ogabassey-checkout-page')
      )
    ).toBe(true);
  });

  it('wraps the checkout loading state in the OgaBassey checkout scope', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        gateway: 'credpal',
        orderId: 'ord-1',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(new Promise<Response>(() => undefined));

    try {
      render(<CheckoutPage />);

      const loadingRoot = await screen
        .findByText(/loading order/i)
        .then((node) => node.closest('.ogabassey-checkout-page'));

      expect(loadingRoot).toBeInTheDocument();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('wraps the resume-error state in the OgaBassey checkout scope', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        gateway: 'credpal',
        orderId: 'ord-1',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    try {
      render(<CheckoutPage />);

      const errorRoot = await screen
        .findByText(/something went wrong/i)
        .then((node) => node.closest('.ogabassey-checkout-page'));

      expect(errorRoot).toBeInTheDocument();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('renders the contact step fields when cart has items', async () => {
    const { useCart } = await import('@/hooks/cart');
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);

    render(<CheckoutPage />);

    // Contact step should show checkout form content
    const match =
      screen.queryByPlaceholderText(/email/i) ??
      screen.queryAllByLabelText(/email/i)[0] ??
      screen.queryByText(/contact/i);
    expect(match).toBeTruthy();
  });

  it('marks desktop order-summary thumbnails as neutral image surfaces', async () => {
    mockCheckoutSubmissionState();

    render(<CheckoutPage />);

    await screen.findAllByText(/secure checkout/i);

    const orderSummary = screen
      .getByRole('heading', { name: /order summary/i })
      .closest('section,aside,div');

    expect(
      orderSummary?.querySelector('.ogabassey-product-card-image-surface')
    ).toBeInTheDocument();
  });

  it('shows Klump in installment checkout when the merchant enables it', async () => {
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 50000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 50000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
        feature_settings: {
          klump_enabled: true,
        },
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: '2 Olaide Tomori Street',
        newAddressState: 'Lagos',
        newAddressCity: 'Ikeja',
        currentStep: 'payment',
        completedSteps: { contact: true, delivery: true },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<CheckoutPage />);

    fireEvent.click(screen.getByRole('button', { name: /pay in installments/i }));

    expect(await screen.findByText('Klump')).toBeInTheDocument();
    fetchMock.mockRestore();
  });

  it('hides Klump in installment checkout when the merchant disables it', async () => {
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 50000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 50000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
        feature_settings: {
          klump_enabled: false,
        },
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: '2 Olaide Tomori Street',
        newAddressState: 'Lagos',
        newAddressCity: 'Ikeja',
        currentStep: 'payment',
        completedSteps: { contact: true, delivery: true },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<CheckoutPage />);

    fireEvent.click(screen.getByRole('button', { name: /pay in installments/i }));

    expect(screen.queryByText('Klump')).not.toBeInTheDocument();
    fetchMock.mockRestore();
  });

  it('hides Klump when wallet credit is auto-applied', async () => {
    vi.mocked(useAuthSafe).mockReturnValue({
      user: {
        id: 'customer-1',
        email: 'ada@example.com',
        user_metadata: {},
      },
    } as unknown as ReturnType<typeof useAuthSafe>);
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 50000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 50000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
        feature_settings: {
          klump_enabled: true,
        },
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: '2 Olaide Tomori Street',
        newAddressState: 'Lagos',
        newAddressCity: 'Ikeja',
        currentStep: 'payment',
        completedSteps: { contact: true, delivery: true },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith('/api/storefront/customer/wallet')) {
          return {
            ok: true,
            json: async () => ({ balance: 10000 }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({}),
          text: async () => '',
        } as Response;
      });

    try {
      render(<CheckoutPage />);

      fireEvent.click(
        screen.getByRole('button', { name: /pay in installments/i }),
      );

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([url]) =>
            String(url).startsWith('/api/storefront/customer/wallet'),
          ),
        ).toBe(true);
      });
      await waitFor(() => {
        expect(screen.queryByText('Klump')).not.toBeInTheDocument();
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('includes merchant_slug and tracking token when resuming an order', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'credpal',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/storefront/orders/ord-1?merchant_slug=test-store&token=tok-123'
      );
    });

    fetchMock.mockRestore();
  });

  it('includes a persisted customer email alongside the tracking token when resuming an order', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'credpal',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );
    vi.mocked(usePersistedState).mockReturnValue(
      [
        {
          orderId: 'ord-1',
          merchantId: 'merchant-1',
          customerEmail: 'resume@example.com',
          customerPhone: '+2348012345678',
          checkoutFingerprint: 'fingerprint',
          amountDueToGateway: 1000,
          createdAt: '2026-04-18T00:00:00.000Z',
        },
        vi.fn(),
        vi.fn(),
      ] as unknown as ReturnType<typeof usePersistedState>
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/storefront/orders/ord-1?merchant_slug=test-store&token=tok-123&email=resume%40example.com'
      );
    });

    fetchMock.mockRestore();
  });

  it('falls back to the persisted customer email for legacy resume links without a token', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'credpal',
      }) as unknown as ReturnType<typeof useSearchParams>
    );
    vi.mocked(usePersistedState).mockReturnValue(
      [
        {
          orderId: 'ord-1',
          merchantId: 'merchant-1',
          customerEmail: 'legacy@example.com',
          customerPhone: '+2348012345678',
          checkoutFingerprint: 'fingerprint',
          amountDueToGateway: 1000,
          createdAt: '2026-04-18T00:00:00.000Z',
        },
        vi.fn(),
        vi.fn(),
      ] as unknown as ReturnType<typeof usePersistedState>
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/storefront/orders/ord-1?merchant_slug=test-store&email=legacy%40example.com'
      );
    });

    fetchMock.mockRestore();
  });

  it('does not fetch a resumed order until a merchant slug is available', async () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'credpal',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/shipping/locations');
    });
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url.startsWith('/api/storefront/orders/ord-1')
      )
    ).toBe(false);

    fetchMock.mockRestore();
  });

  it('does not auto-trigger direct checkout for unsupported resume gateways', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'paystack',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith('/api/storefront/orders/ord-1')) {
          return {
            ok: true,
            json: async () => ({
              id: 'ord-1',
              short_id: 'ORD-1',
              subtotal: 1000,
              shipping_cost: 0,
              total: 1000,
              customer_name: 'Ada Buyer',
              customer_email: 'ada@example.com',
              customer_phone: '+2348123456789',
              tracking_token: 'tok-123',
              shipping_address: { address: '', city: '', state: '' },
              items: [],
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: [], locations: [] }),
          text: async () => '',
        } as Response;
      });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/storefront/orders/ord-1?merchant_slug=test-store&token=tok-123'
      );
    });
    expect(openCredPalCheckout).not.toHaveBeenCalled();
    expect(openCreditDirectCheckout).not.toHaveBeenCalled();

    fetchMock.mockRestore();
  });

  it('persists resumed Credit Direct popup references for webhook reconciliation', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'credit_direct',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.startsWith('/api/storefront/orders/ord-1')) {
          return {
            ok: true,
            json: async () => ({
              id: 'ord-1',
              short_id: 'ORD-1',
              subtotal: 1000,
              shipping_cost: 0,
              total: 1000,
              customer_name: 'Ada Buyer',
              customer_email: 'ada@example.com',
              customer_phone: '+2348123456789',
              tracking_token: 'tok-123',
              shipping_address: { address: '', city: '', state: '' },
              items: [],
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: [], locations: [] }),
          text: async () =>
            typeof init?.body === 'string' ? init.body : '',
        } as Response;
      });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(openCreditDirectCheckout).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(openCreditDirectCheckout).mock.calls[0]?.[0];
    await act(async () => {
      await callArgs?.onPopup?.('cd-popup-transaction-1');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/orders/update-payment-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord-1',
        paymentRef: 'cd-popup-transaction-1',
        gateway: 'credit_direct',
        tracking_token: 'tok-123',
      }),
    });

    fetchMock.mockRestore();
  });

  it('logs resumed Credit Direct popup reference persistence failures', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        orderId: 'ord-1',
        gateway: 'credit_direct',
        trackingToken: 'tok-123',
      }) as unknown as ReturnType<typeof useSearchParams>
    );

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith('/api/storefront/orders/ord-1')) {
          return {
            ok: true,
            json: async () => ({
              id: 'ord-1',
              short_id: 'ORD-1',
              subtotal: 1000,
              shipping_cost: 0,
              total: 1000,
              customer_name: 'Ada Buyer',
              customer_email: 'ada@example.com',
              customer_phone: '+2348123456789',
              tracking_token: 'tok-123',
              shipping_address: { address: '', city: '', state: '' },
              items: [],
            }),
          } as Response;
        }

        if (url === '/api/orders/update-payment-ref') {
          return {
            ok: false,
            status: 500,
            statusText: 'Server Error',
            text: async () => 'write failed',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: [], locations: [] }),
          text: async () => '',
        } as Response;
      });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(openCreditDirectCheckout).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(openCreditDirectCheckout).mock.calls[0]?.[0];
    await act(async () => {
      await callArgs?.onPopup?.('cd-popup-transaction-1');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to persist Credit Direct popup reference:',
      expect.stringContaining('ord-1')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to persist Credit Direct popup reference:',
      expect.stringContaining('cd-popup-transaction-1')
    );

    fetchMock.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('blocks order creation when door delivery has no selected quote', async () => {
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
        paystack_subaccount_code: 'ACCT_test',
        feature_settings: {
          pay_on_delivery_enabled: true,
          paystack_enabled: true,
        },
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: 'Obafemi Awolowo Way',
        newAddressState: 'Lagos',
        newAddressCity: 'Lagos',
        currentStep: 'payment',
        completedSteps: { contact: true, delivery: true },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith('/api/shipping/quotes')) {
          return {
            ok: true,
            json: async () => ({ quotes: { all: [] } }),
            text: async () => '',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    render(<CheckoutPage />);

    fireEvent.click(screen.getByText(/pay on delivery/i));
    const placeOrderButton = screen
      .getAllByRole('button', { name: /place order/i })
      .find((button) => !button.hasAttribute('disabled'));
    expect(placeOrderButton).toBeDefined();
    fireEvent.click(placeOrderButton as HTMLButtonElement);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Select Delivery Option',
        })
      );
    });
    expect(
      fetchMock.mock.calls.some(([url]) => String(url) === '/api/orders')
    ).toBe(false);

    fetchMock.mockRestore();
  });

  it('refetches door quotes after merchant context resolves', async () => {
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: 'Obafemi Awolowo Way',
        newAddressState: 'Lagos',
        newAddressCity: 'Ikeja',
        currentStep: 'delivery',
        completedSteps: { contact: true, delivery: false },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: null,
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith('/api/shipping/quotes')) {
          return {
            ok: true,
            json: async () => ({
              quotes: {
                all: [
                  {
                    carrierName: 'GIG Logistics',
                    currency: 'NGN',
                    displayName: 'Door Delivery',
                    estimatedDays: 2,
                    id: 'quote-1',
                    insuranceIncluded: true,
                    pickupIncluded: true,
                    price: 2500,
                    provider: 'GIGL',
                    serviceTier: 'standard',
                  },
                ],
              },
            }),
            text: async () => '',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    const { rerender } = render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/shipping/locations');
    });
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).startsWith('/api/shipping/quotes')
      )
    ).toBe(false);

    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);

    rerender(<CheckoutPage />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith('/api/shipping/quotes')
        )
      ).toBe(true);
    });
    const quoteCall = fetchMock.mock.calls.find(([url]) =>
      String(url).startsWith('/api/shipping/quotes')
    );
    expect(JSON.parse(String(quoteCall?.[1]?.body))).toEqual(
      expect.objectContaining({ merchantId: 'merchant-1' })
    );

    fetchMock.mockRestore();
  });

  it('refetches quotes with new coordinates when the selected place stays in the same city', async () => {
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: 'Old address, Ikeja',
        newAddressState: 'Lagos',
        newAddressCity: 'Ikeja',
        currentStep: 'delivery',
        completedSteps: { contact: true, delivery: false },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);
    addressAutocompleteMock.selectedPlace = {
      city: 'Ikeja',
      formattedAddress: 'New address, Ikeja',
      location: { latitude: 6.6018, longitude: 3.3515 },
      state: 'Lagos',
    };

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        if (String(input).startsWith('/api/shipping/quotes')) {
          return {
            ok: true,
            json: async () => ({ quotes: { all: [] } }),
            text: async () => '',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith('/api/shipping/quotes'),
        ),
      ).toBe(true);
    });
    fetchMock.mockClear();

    fireEvent.click(screen.getByTestId('select-address-place'));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith('/api/shipping/quotes'),
        ),
      ).toBe(true);
    });
    const quoteCall = fetchMock.mock.calls.find(([url]) =>
      String(url).startsWith('/api/shipping/quotes'),
    );
    expect(JSON.parse(String(quoteCall?.[1]?.body)).receiver).toEqual(
      expect.objectContaining({ latitude: 6.6018, longitude: 3.3515 }),
    );

    fetchMock.mockRestore();
  });

  it('sends a stable idempotency key when creating an order', async () => {
    const scrollSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    window.localStorage.clear();
    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        business_name: 'Test Store',
        vat_registration_status: 'registered',
        vat_rate: 7.5,
        country: 'NG',
        feature_settings: {
          pay_on_delivery_enabled: true,
        },
      },
      basePath: '/test-store',
    } as unknown as ReturnType<typeof useMerchantSafe>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: '2 Olaide Tomori Street',
        newAddressState: 'Lagos',
        newAddressCity: 'Ikeja',
        currentStep: 'delivery',
        completedSteps: { contact: true, delivery: false },
      },
      setValue: vi.fn(),
      setValues: vi.fn(),
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === '/api/orders') {
          return {
            ok: true,
            json: async () => ({
              amountDueToGateway: 5000,
              order: {
                id: 'order-123',
                order_number: 'ORD-123',
                tracking_token: 'track-123',
              },
              wallet: null,
            }),
            text: async () => '',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    await submitPickupPayOnDeliveryOrder();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.find(([url]) => String(url) === '/api/orders')?.[1]
      ).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
          }),
        })
      );
    });
    await waitFor(() => {
      expect(
        window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY)
      ).toBeNull();
    });

    fetchMock.mockRestore();
    randomUuidSpy.mockRestore();
    scrollSpy.mockRestore();
    window.localStorage.clear();
  });

  it('clears the idempotency key when the order is no longer reusable', async () => {
    const scrollSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    window.localStorage.clear();
    mockCheckoutSubmissionState();

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === '/api/orders') {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              code: 'CHECKOUT_ORDER_NOT_REUSABLE',
              details: 'Order is already approved and cannot be reused',
              error: 'Order is not reusable',
            }),
            text: async () => '',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    await submitPickupPayOnDeliveryOrder();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.find(([url]) => String(url) === '/api/orders')?.[1]
      ).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
          }),
        })
      );
    });
    await waitFor(() => {
      expect(
        window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY)
      ).toBeNull();
    });

    fetchMock.mockRestore();
    randomUuidSpy.mockRestore();
    scrollSpy.mockRestore();
    window.localStorage.clear();
  });

  it('clears the idempotency key when checkout idempotency conflicts', async () => {
    const scrollSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    window.localStorage.clear();
    mockCheckoutSubmissionState();

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === '/api/orders') {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              code: 'CHECKOUT_IDEMPOTENCY_CONFLICT',
              error:
                'This checkout request was already used for a different cart, customer, or delivery payload.',
            }),
            text: async () => '',
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    await submitPickupPayOnDeliveryOrder();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.find(([url]) => String(url) === '/api/orders')?.[1]
      ).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
          }),
        })
      );
    });
    await waitFor(() => {
      expect(
        window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY)
      ).toBeNull();
    });

    fetchMock.mockRestore();
    randomUuidSpy.mockRestore();
    scrollSpy.mockRestore();
    window.localStorage.clear();
  });

  it('debounces inferred manual address location updates before mutating checkout location', async () => {
    vi.useFakeTimers();
    const setValue = vi.fn();
    const setValues = vi.fn();

    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: '',
        newAddressState: '',
        newAddressCity: '',
        currentStep: 'delivery',
        completedSteps: { contact: true, delivery: false },
      },
      setValue,
      setValues,
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ states: ['Lagos'], locations: [] }),
        text: async () => '',
      } as Response);

    try {
      const { unmount } = render(<CheckoutPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith('/api/shipping/locations');

      fireEvent.change(screen.getByTestId('address-input'), {
        target: { value: 'Lekki, Lagos' },
      });

      expect(setValue).toHaveBeenCalledWith(
        'newAddressStreet',
        'Lekki, Lagos'
      );
      expect(setValue).not.toHaveBeenCalledWith(
        'newAddressState',
        expect.any(String)
      );
      expect(setValue).not.toHaveBeenCalledWith(
        'newAddressCity',
        expect.any(String)
      );
      expect(setValues).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(499);
      });

      expect(setValues).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(setValues).toHaveBeenCalledWith({
        newAddressCity: 'Lekki',
        newAddressState: 'Lagos',
      });

      unmount();
    } finally {
      fetchMock.mockRestore();
      vi.useRealTimers();
    }
  });

  it('clears inferred city/state when manual address parsing no longer succeeds', async () => {
    vi.useFakeTimers();
    const setValue = vi.fn();
    const setValues = vi.fn();

    vi.mocked(useCart).mockReturnValue({
      cart: [
        {
          id: 'item-1',
          name: 'Test Product',
          price: 5000,
          quantity: 1,
          image: '',
          slug: 'test-product',
        },
      ],
      cartTotal: 5000,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(usePersistedForm).mockReturnValue({
      values: {
        firstName: 'Ada',
        lastName: 'Buyer',
        customerEmail: 'ada@example.com',
        customerPhone: '+2348123456789',
        newAddressStreet: '',
        newAddressState: '',
        newAddressCity: '',
        currentStep: 'delivery',
        completedSteps: { contact: true, delivery: false },
      },
      setValue,
      setValues,
      clear: vi.fn(),
    } as unknown as ReturnType<typeof usePersistedForm>);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ states: ['Lagos'], locations: [] }),
        text: async () => '',
      } as Response);

    try {
      render(<CheckoutPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith('/api/shipping/locations');

      fireEvent.change(screen.getByTestId('address-input'), {
        target: { value: 'Lekki, Lagos' },
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(setValues).toHaveBeenCalledWith({
        newAddressCity: 'Lekki',
        newAddressState: 'Lagos',
      });

      fireEvent.change(screen.getByTestId('address-input'), {
        target: { value: 'Lekki, Nigeria' },
      });

      expect(setValues).toHaveBeenCalledWith({
        newAddressCity: '',
        newAddressState: '',
      });
    } finally {
      fetchMock.mockRestore();
      vi.useRealTimers();
    }
  });

  it('invokes calculateCommerce with subtotal excluding assurance and sends quantity-multiplied assurance to /api/orders', async () => {
    vi.mocked(hasPriceNegotiationEntitlement).mockReturnValue(true);

    // Set up cart with a negotiated price + assurance + quantity > 1
    const mockCart = [
      {
        id: 'item-1',
        cartItemId: 'ci-1',
        name: 'Test Product',
        price: 5000,
        negotiatedPrice: 4000,
        negotiationStatus: 'accepted' as const,
        quantity: 2,
        image: '',
        slug: 'test-product',
        hasAssurance: true,
        assuranceRate: 0.05,
      },
    ];

    mockCheckoutSubmissionState();
    // Overwrite the cart/cartTotal mock values that mockCheckoutSubmissionState sets
    vi.mocked(useCart).mockReturnValue({
      cart: mockCart,
      cartTotal: 8400, // 4000 * 2 + (4000 * 2 * 0.05) = 8000 + 400 = 8400
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);

    const { calculateCommerce } = await import('@/lib/supabase/client');
    vi.mocked(calculateCommerce).mockResolvedValue({
      total: 8000,
      taxAmount: 600, // 8000 * 7.5%
    });

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === '/api/orders') {
          return {
            ok: true,
            json: async () => ({
              amountDueToGateway: 9000,
              order: { id: 'order-123', order_number: 'ORD-123', tracking_token: 'track-123' },
              wallet: null,
            }),
            text: async () => '',
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    render(<CheckoutPage />);

    // Expect calculateCommerce to be called with itemSubtotal (8000), not checkoutCartTotal (8400)
    await waitFor(() => {
      expect(calculateCommerce).toHaveBeenCalledWith(
        'calculate_order',
        expect.objectContaining({ subtotal: 8000 })
      );
    });

    // Let's submit the order
    fireEvent.click(screen.getByRole('button', { name: /store pickup/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
    fireEvent.click(await screen.findByText(/pay on delivery/i));
    const placeOrderButton = screen
      .getAllByRole('button', { name: /place order/i })
      .find((button) => !button.hasAttribute('disabled'));
    expect(placeOrderButton).toBeDefined();
    fireEvent.click(placeOrderButton as HTMLButtonElement);

    await waitFor(() => {
      const orderCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/orders');
      expect(orderCall).toBeDefined();
      const body = JSON.parse(orderCall![1]!.body as string);

      // Items assurance fee should be quantity multiplied
      expect(body.items).toEqual([
        expect.objectContaining({
          product_id: 'item-1',
          quantity: 2,
          price: 4000,
          has_assurance: true,
          assurance_fee: 400, // (4000 * 2) * 0.05
        }),
      ]);

      //expected_total = checkoutCartTotal (8400) + deliveryCost (0) + giftWrappingCost (0) + taxAmount (600) = 9000
      expect(body.tax_amount).toBe(600);
      expect(body.expected_total).toBe(9000);
      expect(body.client_total).toBe(9000);
    });

    fetchMock.mockRestore();
  });

  it('strips/ignores negotiated price and cartDiscount when merchant is not entitled', async () => {
    vi.mocked(hasPriceNegotiationEntitlement).mockReturnValue(false);

    // Set up cart with a negotiated price + cartDiscount
    const mockCart = [
      {
        id: 'item-1',
        cartItemId: 'ci-1',
        name: 'Test Product',
        price: 5000,
        negotiatedPrice: 4000,
        negotiationStatus: 'accepted' as const,
        cartDiscount: 1000,
        quantity: 2,
        image: '',
        slug: 'test-product',
        hasAssurance: false,
      },
    ];

    mockCheckoutSubmissionState();
    // Overwrite the cart/cartTotal mock values that mockCheckoutSubmissionState sets
    vi.mocked(useCart).mockReturnValue({
      cart: mockCart,
      cartTotal: 10000, // price (5000) * quantity (2) = 10000 (discounts stripped)
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);

    const { calculateCommerce } = await import('@/lib/supabase/client');
    vi.mocked(calculateCommerce).mockResolvedValue({
      total: 10000,
      taxAmount: 750, // 10000 * 7.5%
    });

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === '/api/orders') {
          return {
            ok: true,
            json: async () => ({
              amountDueToGateway: 10750,
              order: { id: 'order-123', order_number: 'ORD-123', tracking_token: 'track-123' },
              wallet: null,
            }),
            text: async () => '',
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    render(<CheckoutPage />);

    // Expect calculateCommerce to be called with baseline subtotal (10000), not negotiated/discounted
    await waitFor(() => {
      expect(calculateCommerce).toHaveBeenCalledWith(
        'calculate_order',
        expect.objectContaining({ subtotal: 10000 })
      );
    });

    // Let's submit the order
    fireEvent.click(screen.getByRole('button', { name: /store pickup/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
    fireEvent.click(await screen.findByText(/pay on delivery/i));
    const placeOrderButton = screen
      .getAllByRole('button', { name: /place order/i })
      .find((button) => !button.hasAttribute('disabled'));
    expect(placeOrderButton).toBeDefined();
    fireEvent.click(placeOrderButton as HTMLButtonElement);

    await waitFor(() => {
      const orderCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/orders');
      expect(orderCall).toBeDefined();
      const body = JSON.parse(orderCall![1]!.body as string);

      // Items price should be baseline (5000), not negotiated (4000)
      expect(body.items).toEqual([
        expect.objectContaining({
          product_id: 'item-1',
          quantity: 2,
          price: 5000,
        }),
      ]);

      expect(body.tax_amount).toBe(750);
      expect(body.expected_total).toBe(10750);
    });

    fetchMock.mockRestore();
  });

  it('reserves the full order-summary scroll region so multi-item cart hydration does not reflow #main-content', async () => {
    mockCheckoutSubmissionState();

    render(<CheckoutPage />);

    await screen.findAllByText(/secure checkout/i);

    const orderSummary = screen
      .getByRole('heading', { name: /order summary/i })
      .closest('section,aside,div');

    expect(
      orderSummary?.querySelector('[class*="h-[200px]"]')
    ).toBeInTheDocument();
  });

  it('keeps delivery quotes in a fixed scroll region so multi-quote loading does not reflow #main-content', async () => {
    mockCheckoutSubmissionState();

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith('/api/shipping/quotes')) {
          return {
            ok: true,
            json: async () => ({ quotes: { all: [] } }),
            text: async () => '',
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ states: ['Lagos'], locations: [] }),
          text: async () => '',
        } as Response;
      });

    const { container } = render(<CheckoutPage />);

    await screen.findByText(/select delivery option/i);

    expect(
      container.querySelector('[class*="h-[320px]"]')
    ).toBeInTheDocument();

    fetchMock.mockRestore();
  });
});
