import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all heavy dependencies before importing the component
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
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
  AddressAutocomplete: vi.fn(({ value, onChangeText, ...props }) => (
    <input
      data-testid="address-input"
      value={value || ''}
      onChange={(e) => onChangeText?.(e.target.value)}
      {...props}
    />
  )),
}));

vi.mock('@/lib/credpal', () => ({
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
  CredPalLogo: vi.fn(() => null),
  CreditDirectLogo: vi.fn(() => null),
  JuicywayLogo: vi.fn(() => null),
  BankTransferLogo: vi.fn(() => null),
}));

vi.mock('../components/MobileCheckoutComponents', () => ({
  MobileOrderSummary: vi.fn(() => null),
}));

import { CheckoutPage } from './checkout-page';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { usePersistedState } from '@/hooks/use-persisted-state';

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.mocked(useCart).mockReturnValue({
      cart: [],
      cartTotal: 0,
      clearCart: vi.fn(),
      isHydrated: true,
    } as unknown as ReturnType<typeof useCart>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>
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
});
