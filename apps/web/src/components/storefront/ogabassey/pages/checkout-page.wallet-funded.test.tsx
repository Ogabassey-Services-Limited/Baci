import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors the mock surface of checkout-page.test.tsx — the page pulls in the
// whole storefront shell, so every heavy dependency is stubbed.
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('@/lib/feature-flags', () => ({
  hasPriceNegotiationEntitlement: vi.fn(() => true),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
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
  })),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: {
      id: 'merchant-1',
      slug: 'test-store',
      business_name: 'Test Store',
      country: 'NG',
      paystack_subaccount_code: 'ACCT_test',
      vat_registration_status: 'not_registered',
      feature_settings: {
        paystack_enabled: true,
        wallet_paystack_dva_enabled: true,
      },
    },
    basePath: '/test-store',
  })),
}));

vi.mock('@/hooks/use-persisted-state', () => ({
  usePersistedForm: vi.fn(() => ({
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
  })),
  usePersistedState: vi.fn(() => [null, vi.fn(), vi.fn()]),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuthSafe: vi.fn(() => ({
    user: { id: 'user-1', email: 'ada@example.com', user_metadata: {} },
  })),
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
  calculateCommerce: vi.fn().mockResolvedValue({ total: 5000, taxAmount: 0 }),
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
  AddressAutocomplete: vi.fn(({ value, onChange, onChangeText, ...props }) => (
    <input
      data-testid="address-input"
      value={value || ''}
      onChange={(e) => {
        onChange?.(e);
        onChangeText?.(e.target.value);
      }}
      {...props}
    />
  )),
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

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

import { useAuthSafe } from '@/contexts/auth-context';
import { CheckoutPage } from './checkout-page';

const FLAG = 'NEXT_PUBLIC_WALLET_ORDER_AUTO_DEBIT_ENABLED';
const INTENTS_URL = '/api/storefront/customer/wallet/order-funding-intents';

const ORDER_RESPONSE = {
  order: {
    id: '00000000-0000-4000-8000-0000000000a1',
    currency: 'NGN',
    tracking_token: 'track-1',
  },
  amountDueToGateway: 5000,
};

interface FetchStubOptions {
  intentResponse?: { body: unknown; status: number };
}

function stubFetch({ intentResponse }: FetchStubOptions = {}) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = String(input);
      const ok = (body: unknown, status = 200) =>
        ({
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
          text: async () => JSON.stringify(body),
        }) as Response;

      if (url === '/api/orders' && init?.method === 'POST') {
        return ok(ORDER_RESPONSE);
      }
      if (url === '/api/payments/initialize') {
        return ok({
          success: true,
          reference: 'PSK_REF_1',
          dva: {
            account_number: '9999999999',
            account_name: 'Order DVA',
            bank_name: 'Wema Bank',
            bank_code: '035',
          },
        });
      }
      if (url === INTENTS_URL) {
        return ok(
          intentResponse?.body ?? {
            account: {
              accountName: 'Ada Buyer',
              accountNumber: '1234567890',
              bankName: 'Wema Bank',
              provider: 'paystack',
            },
            intent: {
              currency: 'NGN',
              expectedAmount: 5000,
              expiresAt: '2099-01-01T10:30:00.000Z',
              fundedAmount: 0,
              id: '00000000-0000-4000-8000-0000000000b1',
              orderId: ORDER_RESPONSE.order.id,
              status: 'pending',
              targetOrderAmount: 5000,
            },
          },
          intentResponse?.status ?? 200
        );
      }
      if (url.startsWith(`${INTENTS_URL}/`)) {
        return ok({
          intent: {
            currency: 'NGN',
            expectedAmount: 5000,
            expiresAt: '2099-01-01T10:30:00.000Z',
            fundedAmount: 0,
            id: '00000000-0000-4000-8000-0000000000b1',
            orderId: ORDER_RESPONSE.order.id,
            status: 'pending',
            targetOrderAmount: 5000,
          },
        });
      }
      if (url.startsWith('/api/storefront/customer/wallet')) {
        return ok({ balance: 0 });
      }
      if (url.startsWith('/api/shipping/quotes')) {
        return ok({ quotes: { all: [] } });
      }
      return ok({ states: ['Lagos'], locations: [] });
    });
}

async function placeBankTransferOrder() {
  render(<CheckoutPage />);

  fireEvent.click(screen.getByRole('button', { name: /store pickup/i }));
  fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
  fireEvent.click(await screen.findByText(/^Bank Transfer$/));

  const placeOrderButton = screen
    .getAllByRole('button', { name: /place order/i })
    .find((button) => !button.hasAttribute('disabled'));
  expect(placeOrderButton).toBeDefined();
  fireEvent.click(placeOrderButton as HTMLButtonElement);
}

function called(fetchMock: ReturnType<typeof stubFetch>, url: string) {
  return fetchMock.mock.calls.some(([input]) => String(input) === url);
}

const SIGNED_IN = {
  user: { id: 'user-1', email: 'ada@example.com', user_metadata: {} },
} as unknown as ReturnType<typeof useAuthSafe>;

describe('CheckoutPage — wallet-funded bank transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-assert the signed-in default: the guest case below overrides it.
    vi.mocked(useAuthSafe).mockReturnValue(SIGNED_IN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is a complete no-op when the flag is off: signed-in customers still mint an order DVA', async () => {
    vi.stubEnv(FLAG, '');
    const fetchMock = stubFetch();

    await placeBankTransferOrder();

    await waitFor(() => {
      expect(called(fetchMock, '/api/payments/initialize')).toBe(true);
    });
    expect(called(fetchMock, INTENTS_URL)).toBe(false);
  });

  it('keeps guests on the order-DVA path even with the flag on', async () => {
    vi.stubEnv(FLAG, 'true');
    vi.mocked(useAuthSafe).mockReturnValue(
      null as unknown as ReturnType<typeof useAuthSafe>
    );
    const fetchMock = stubFetch();

    await placeBankTransferOrder();

    await waitFor(() => {
      expect(called(fetchMock, '/api/payments/initialize')).toBe(true);
    });
    expect(called(fetchMock, INTENTS_URL)).toBe(false);
  });

  it('falls back to the order-DVA path when the merchant has auto-debit disabled', async () => {
    vi.stubEnv(FLAG, 'true');
    const fetchMock = stubFetch({
      intentResponse: {
        body: { code: 'WALLET_ORDER_AUTO_DEBIT_DISABLED', kind: 'fallback' },
        status: 403,
      },
    });

    await placeBankTransferOrder();

    await waitFor(() => {
      expect(called(fetchMock, INTENTS_URL)).toBe(true);
    });
    await waitFor(() => {
      expect(called(fetchMock, '/api/payments/initialize')).toBe(true);
    });
  });

  it('shows the wallet account number and never mints an order DVA when the intent opens', async () => {
    vi.stubEnv(FLAG, 'true');
    const fetchMock = stubFetch();

    await placeBankTransferOrder();

    expect(await screen.findByText('1234567890')).toBeDefined();
    expect(screen.getByText(/pays this order from your wallet/i)).toBeDefined();
    expect(called(fetchMock, '/api/payments/initialize')).toBe(false);
  });
});
