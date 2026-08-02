import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reloadMerchantMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const useMerchantMock = vi.hoisted(() => vi.fn());
const bankFormProps = vi.hoisted(
  () =>
    [] as {
      merchantId: string;
      onSuccess?: (savedBank: {
        accountNumber: string;
        businessName: string;
        merchantId: string;
      }) => void;
    }[]
);

vi.mock('@/components/merchant-bank-form', () => ({
  MerchantBankForm: (props: (typeof bankFormProps)[number]) => {
    bankFormProps.push(props);
    return (
      <button
        type="button"
        onClick={() =>
          props.onSuccess?.({
            accountNumber: '1234567890',
            businessName: 'Saved Store',
            merchantId: props.merchantId,
          })
        }
      >
        Complete bank save
      </button>
    );
  },
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: useMerchantMock,
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('./components/virtual-terminal-settings', () => ({
  VirtualTerminalSettings: () => null,
}));

import { fetchWithCsrf } from '@/lib/api-client';
import PaymentSettingsPage from './page';

const merchantA = {
  id: '11111111-1111-4111-8111-111111111111',
  business_name: 'Merchant A',
  country: 'IN',
  bank_account_number: null,
  paystack_subaccount_code: null,
};
const merchantB = {
  ...merchantA,
  id: '22222222-2222-4222-8222-222222222222',
  business_name: 'Merchant B',
};
const merchantASettings = {
  paystack_enabled: false,
  korapay_enabled: false,
  pay_on_delivery_enabled: false,
  preferred_local_gateway: 'korapay',
  preferred_international_gateway: 'korapay',
  credit_direct_enabled: false,
};
const merchantBSettings = {
  ...merchantASettings,
  pay_on_delivery_enabled: true,
};

describe('PaymentSettingsPage bank completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bankFormProps.length = 0;
    useMerchantMock.mockReturnValue({
      merchant: merchantA,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    vi.mocked(fetchWithCsrf).mockResolvedValue({ ok: true } as Response);
  });

  it('refreshes bank completion only for the selected merchant context', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => merchantASettings,
    }) as typeof fetch;

    render(<PaymentSettingsPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Complete bank save' })
    );

    expect(bankFormProps.at(-1)?.merchantId).toBe(merchantA.id);
    expect(reloadMerchantMock).toHaveBeenCalledOnce();
  });

  it('shows merchant A as connected after its bank save without affecting merchant B', async () => {
    const user = userEvent.setup();
    const merchantAWithPaystack = { ...merchantA, country: 'NG' };
    const merchantBWithPaystack = { ...merchantB, country: 'NG' };
    global.fetch = vi.fn((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input.includes(merchantBWithPaystack.id)
            ? merchantBSettings
            : merchantASettings,
      } as Response)
    ) as typeof fetch;
    useMerchantMock.mockReturnValue({
      merchant: merchantAWithPaystack,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });

    const { rerender } = render(<PaymentSettingsPage />);
    await screen.findByText('Bank Account Required');
    await user.click(
      screen.getByRole('button', { name: 'Complete bank save' })
    );
    await screen.findByText('Bank Account Connected');

    useMerchantMock.mockReturnValue({
      merchant: merchantBWithPaystack,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    rerender(<PaymentSettingsPage />);

    expect(
      await screen.findByText('Bank Account Required')
    ).toBeInTheDocument();
  });

  it('ignores a prior visit to merchant A after switching away and back', async () => {
    const merchantAWithPaystack = { ...merchantA, country: 'NG' };
    const merchantBWithPaystack = { ...merchantB, country: 'NG' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => merchantASettings,
    }) as typeof fetch;
    useMerchantMock.mockReturnValue({
      merchant: merchantAWithPaystack,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });

    const { rerender } = render(<PaymentSettingsPage />);
    await screen.findByText('Bank Account Required');
    const oldMerchantASave = bankFormProps.at(-1)?.onSuccess;

    useMerchantMock.mockReturnValue({
      merchant: merchantBWithPaystack,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    rerender(<PaymentSettingsPage />);
    await screen.findByText('Bank Account Required');

    useMerchantMock.mockReturnValue({
      merchant: merchantAWithPaystack,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    rerender(<PaymentSettingsPage />);
    await screen.findByText('Bank Account Required');

    await act(async () =>
      oldMerchantASave?.({
        accountNumber: '1234567890',
        businessName: 'Saved Store',
        merchantId: merchantA.id,
      })
    );

    expect(reloadMerchantMock).not.toHaveBeenCalled();
    expect(screen.getByText('Bank Account Required')).toBeInTheDocument();
  });
});
