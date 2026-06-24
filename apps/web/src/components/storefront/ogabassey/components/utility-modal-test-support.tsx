import { vi } from 'vitest';
import { toast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

const {
  mockAirtimeSubmitAmount,
  mockFetchWithCsrf,
  mockRedirectToPaymentCheckout,
  mockUseCustomerAuth,
  mockUseWallet,
} = vi.hoisted(() => ({
  mockAirtimeSubmitAmount: { current: 100 },
  mockFetchWithCsrf: vi.fn(),
  mockRedirectToPaymentCheckout: vi.fn(),
  mockUseCustomerAuth: vi.fn(),
  mockUseWallet: vi.fn(),
}));

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('./utility-checkout', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./utility-checkout')>();

  return {
    ...original,
    redirectToPaymentCheckout: mockRedirectToPaymentCheckout,
  };
});

vi.mock('./utility/AirtimeDataForm', () => ({
  AirtimeDataForm: ({
    loading,
    onSubmit,
    type,
  }: {
    loading: boolean;
    onSubmit: (data: Record<string, unknown>) => void;
    type: string;
  }) => (
    <div
      data-testid="airtime-data-form"
      data-type={type}
      data-loading={String(loading)}
    >
      <button
        type="button"
        onClick={() =>
          onSubmit({
            amount: mockAirtimeSubmitAmount.current,
            networkProvider: 'MTN',
            phoneNumber: '08012345678',
          })
        }
      >
        Mock Submit
      </button>
    </div>
  ),
}));

vi.mock('./utility/BillPaymentForm', () => ({
  BillPaymentForm: ({
    loading,
    onSubmit,
    type,
  }: {
    loading: boolean;
    onSubmit: (data: Record<string, unknown>) => void;
    type: string;
  }) => (
    <div
      data-testid="bill-payment-form"
      data-type={type}
      data-loading={String(loading)}
    >
      <button
        type="button"
        onClick={() =>
          onSubmit({
            amount: 5000,
            billerName: 'DStv',
            billItemIdentifier: 'DSTV',
            customerIdentifier: '123',
            type: 'cable_tv',
          })
        }
      >
        Mock Bill Submit
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ merchant: { slug: 'ogabassey' } }),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => mockUseCustomerAuth(),
}));

vi.mock('@/components/storefront/ogabassey/pages/checkout/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

function createJsonResponse(
  body: Record<string, unknown>,
  init: { ok?: boolean; status?: number } = {}
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const mockOnClose = vi.fn();

export const utilityModalTestHarness = {
  amount: mockAirtimeSubmitAmount,
  checkoutFetch: vi.mocked(fetchWithCsrf),
  createJsonResponse,
  onClose: mockOnClose,
  redirect: mockRedirectToPaymentCheckout,
  toast: vi.mocked(toast),
  useAuth: mockUseCustomerAuth,
  useWallet: mockUseWallet,
  reset() {
    mockOnClose.mockClear();
    this.toast.mockClear();
    this.checkoutFetch.mockReset();
    mockRedirectToPaymentCheckout.mockReset();
    mockAirtimeSubmitAmount.current = 100;
    mockUseCustomerAuth.mockReturnValue({
      customer: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Test',
        last_name: 'Customer',
        phone: '08012345678',
      },
      isAuthenticated: true,
      isLoading: false,
      user: {
        email: 'customer@example.com',
        id: 'user-1',
        role: 'customer',
      },
    });
    mockUseWallet.mockReturnValue({
      payWithWallet: true,
      setPayWithWallet: vi.fn(),
      setWalletBalance: vi.fn(),
      walletBalance: 500,
      walletLoading: false,
    });
    this.checkoutFetch.mockResolvedValue(
      createJsonResponse({
        amount: 100,
        reference: 'REF123456',
        status: 'successful',
      })
    );
  },
};
