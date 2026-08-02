import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockMerchantBankFormProps = {
  merchantId: string;
  initialData?: {
    accountName?: string;
    accountNumber?: string;
    bankCode?: string;
    bankName?: string;
    businessName?: string;
  };
  onSuccess?: (savedBank: {
    accountName?: string;
    accountNumber: string;
    bankCode?: string;
    bankName?: string;
    businessName: string;
    merchantId: string;
  }) => void;
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
        onClick={() =>
          props.onSuccess?.({
            accountName: 'Updated Account Name',
            accountNumber: '1234567890',
            bankCode: '044',
            bankName: 'Guaranty Trust Bank',
            businessName: 'Updated Store',
            merchantId: props.merchantId,
          })
        }
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
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('./components/virtual-terminal-settings', () => ({
  VirtualTerminalSettings: () => null,
}));

import PaymentSettingsPage from './page';

const featureSettings = {
  paystack_enabled: false,
  korapay_enabled: false,
  pay_on_delivery_enabled: false,
  preferred_local_gateway: 'paystack',
  preferred_international_gateway: 'paystack',
  credit_direct_enabled: false,
};

describe('PaymentSettingsPage Paystack settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    merchantBankFormProps.length = 0;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => featureSettings,
    }) as typeof fetch;
  });

  it('hydrates saved Nigerian bank details, refreshes, and records submitted values locally', async () => {
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

    expect(reloadMerchantMock).toHaveBeenCalledOnce();
    expect(merchantBankFormProps.at(-1)?.initialData).toEqual(
      expect.objectContaining({
        accountName: 'Updated Account Name',
        accountNumber: '1234567890',
        bankCode: '044',
        bankName: 'Guaranty Trust Bank',
        businessName: 'Updated Store',
      })
    );
  });

  it('recognizes the derived Paystack subaccount capability without exposing a code', async () => {
    useMerchantMock.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Baci Store',
        country: 'NG',
        bank_account_number: null,
        paystack_subaccount_code: null,
        paystack_subaccount_configured: true,
      },
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });

    render(<PaymentSettingsPage />);

    expect(
      await screen.findByText('Bank Account Connected')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /toggle paystack/i })
    ).toBeEnabled();
  });
});
