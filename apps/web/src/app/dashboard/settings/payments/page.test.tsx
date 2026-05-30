import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockMerchantBankFormProps = {
  initialData?: {
    accountNumber?: string;
    bankName?: string;
    businessName?: string;
  };
  onSuccess?: () => void;
};

const merchantBankFormProps = vi.hoisted(
  () => [] as MockMerchantBankFormProps[]
);
const reloadMerchantMock = vi.hoisted(() => vi.fn());
const useMerchantMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/merchant-bank-form', () => ({
  MerchantBankForm: (props: MockMerchantBankFormProps) => {
    merchantBankFormProps.push(props);
    return (
      <button
        data-testid="merchant-bank-form"
        onClick={() => props.onSuccess?.()}
        type="button"
      >
        Mock Bank Form
      </button>
    );
  },
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: useMerchantMock,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

vi.mock('./components/virtual-terminal-settings', () => ({
  VirtualTerminalSettings: () => (
    <div data-testid="virtual-terminal-settings" />
  ),
}));

import { fetchWithCsrf } from '@/lib/api-client';
import PaymentSettingsPage from './page';

const featureSettings = {
  paystack_enabled: false,
  korapay_enabled: false,
  pay_on_delivery_enabled: false,
  preferred_local_gateway: 'paystack',
  preferred_international_gateway: 'paystack',
  credit_direct_enabled: false,
};

describe('PaymentSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    merchantBankFormProps.length = 0;
    window.history.replaceState({}, '', '/dashboard/settings/payments');
    useMerchantMock.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Yodha Shopping',
        country: 'IN',
        bank_account_number: null,
        paystack_subaccount_code: null,
      },
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    vi.mocked(fetchWithCsrf).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => featureSettings,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }) as typeof fetch;
  });

  it('lets India merchants enable Pay on Delivery from payment settings', async () => {
    const user = userEvent.setup();

    render(<PaymentSettingsPage />);

    expect(
      await screen.findByRole('heading', { name: /pay on delivery/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/paystack is not available for this country yet/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('switch', { name: /toggle pay on delivery/i })
    );
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(fetchWithCsrf).toHaveBeenCalledWith(
        '/api/merchant/features',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.any(String),
        })
      );
    });

    const saveCall = vi.mocked(fetchWithCsrf).mock.calls.at(-1);
    const body = JSON.parse(String(saveCall?.[1]?.body));
    expect(body).toEqual(
      expect.objectContaining({
        pay_on_delivery_enabled: true,
        paystack_enabled: false,
        preferred_local_gateway: 'korapay',
        preferred_international_gateway: 'korapay',
      })
    );
  });

  it('re-enables the save button when onboarding payment settings save fails', async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      {},
      '',
      '/dashboard/settings/payments?onboarding=true'
    );
    vi.mocked(fetchWithCsrf).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<PaymentSettingsPage />);

    await screen.findByRole('heading', { name: /pay on delivery/i });
    const saveButton = screen.getByRole('button', { name: /save settings/i });

    await user.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
  });

  it('does not collect bank account details for India merchants', async () => {
    render(<PaymentSettingsPage />);

    expect(
      await screen.findByText(/bank settlement unavailable/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('merchant-bank-form')).not.toBeInTheDocument();
    expect(screen.queryByText(/bank details saved/i)).not.toBeInTheDocument();
  });

  it('does not show hardcoded Nigerian currency labels for India merchants', async () => {
    render(<PaymentSettingsPage />);

    expect(
      await screen.findByRole('heading', { name: /payment settings/i })
    ).toBeInTheDocument();

    expect(screen.getByText('Local Payments (INR)')).toBeInTheDocument();
    expect(screen.getByText(/Baci charges/i)).toHaveTextContent(
      '2% per transaction'
    );
    expect(screen.getByText(/Baci charges/i)).not.toHaveTextContent('₹2,050');
    expect(
      screen.queryByText(/Local Payments \(NGN\)/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/N2,050/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/N100/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Nigerian Naira \(NGN\)/i)
    ).not.toBeInTheDocument();
  });

  it('keeps Paystack fee copy Nigerian for Nigerian merchants', async () => {
    useMerchantMock.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Baci Store',
        country: 'NG',
        bank_account_number: '1234567890',
        bank_account_name: 'Baci Store',
        bank_code: '044',
        bank_name: 'Guaranty Trust Bank',
        paystack_subaccount_code: 'ACCT_test123',
      },
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });

    render(<PaymentSettingsPage />);

    expect(
      await screen.findByRole('heading', { name: /payment settings/i })
    ).toBeInTheDocument();

    expect(screen.getByText('Local Payments (NGN)')).toBeInTheDocument();
    expect(screen.getByText(/Paystack:/i)).toHaveTextContent('₦100');
    expect(screen.getByText(/Baci charges/i)).toHaveTextContent('₦2,050');
  });

  it('hydrates saved Nigerian bank details and reloads after bank save', async () => {
    const user = userEvent.setup();
    useMerchantMock.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Baci Store',
        country: 'NG',
        bank_account_number: '1234567890',
        bank_account_name: 'Baci Store',
        bank_code: '044',
        bank_name: 'Guaranty Trust Bank',
        paystack_subaccount_code: 'ACCT_test123',
      },
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });

    render(<PaymentSettingsPage />);

    expect(
      await screen.findByText('Bank Account Connected')
    ).toBeInTheDocument();
    expect(merchantBankFormProps[0]?.initialData).toEqual(
      expect.objectContaining({
        accountNumber: '1234567890',
        bankName: 'Guaranty Trust Bank',
        businessName: 'Baci Store',
      })
    );

    await user.click(screen.getByTestId('merchant-bank-form'));

    expect(reloadMerchantMock).toHaveBeenCalled();
  });
});
