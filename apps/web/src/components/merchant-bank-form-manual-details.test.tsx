import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastSpy = vi.fn();
const apiPostMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: toastSpy })),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

import { MerchantBankForm } from './merchant-bank-form';

const merchantId = '22222222-2222-4222-8222-222222222222';
const manualBankData = {
  accountNumber: 'IN-123456789012',
  bankName: 'HDFC Bank',
  accountName: 'Yodha Shopping',
  businessName: 'Yodha Shopping',
};

describe('MerchantBankForm manual bank details', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ banks: [] }),
      })
    );
    apiPostMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/paystack/subaccount') {
        return Promise.resolve({
          success: true,
          accountName: 'Jane Doe',
          subaccountCode: 'ACCT_TESTMOCK1234567',
        });
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });
  });

  it('saves manual invoice bank details for non-Nigerian merchants', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(
      <MerchantBankForm
        merchantId={merchantId}
        countryCode="IN"
        initialData={manualBankData}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText(/manual invoice bank details/i)).toBeTruthy();
    expect(screen.getByLabelText('Account Number')).toHaveValue(
      'IN-123456789012'
    );
    expect(screen.getByLabelText('Bank Name')).toHaveValue('HDFC Bank');
    expect(screen.getByLabelText('Account Name')).toHaveValue('Yodha Shopping');
    expect(
      screen.queryByPlaceholderText(
        'Type to search your bank (e.g. GTB, Access)'
      )
    ).toBeNull();
    expect(screen.queryByText('Account Verified')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/paystack/subaccount', {
        merchantId,
        accountNumber: 'IN-123456789012',
        account_name: 'Yodha Shopping',
        bank_name: 'HDFC Bank',
        businessName: 'Yodha Shopping',
      });
    });
    expect(apiPostMock).not.toHaveBeenCalledWith(
      '/api/paystack/resolve',
      expect.anything()
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bank Details Saved',
        description: 'Manual bank details will appear on unpaid invoices.',
      })
    );
  });

  it('limits manual account numbers by normalized length', () => {
    render(
      <MerchantBankForm
        merchantId={merchantId}
        countryCode="IN"
        initialData={{ businessName: 'Yodha Shopping' }}
      />
    );
    const accountInput = screen.getByLabelText('Account Number');
    const formattedAccountNumber = 'ABCD EFGH IJKL MNOP QRST UVWX YZ12 345678';
    fireEvent.change(accountInput, {
      target: { value: formattedAccountNumber },
    });
    expect(accountInput).toHaveValue(formattedAccountNumber);
    fireEvent.change(accountInput, {
      target: { value: `${formattedAccountNumber}9` },
    });
    expect(accountInput).toHaveValue(formattedAccountNumber);
  });

  it('shows an error when manual invoice bank details fail to save', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    apiPostMock.mockRejectedValueOnce(new Error('Manual details unavailable'));
    render(
      <MerchantBankForm
        merchantId={merchantId}
        countryCode="IN"
        initialData={manualBankData}
        onSuccess={onSuccess}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Manual details unavailable',
        })
      );
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('syncs manual validation mode when country support changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MerchantBankForm
        merchantId={merchantId}
        countryCode="NG"
        initialData={{ businessName: 'Yodha Shopping' }}
      />
    );
    rerender(
      <MerchantBankForm
        merchantId={merchantId}
        countryCode="IN"
        initialData={{ businessName: 'Yodha Shopping' }}
      />
    );

    expect(screen.getByText(/manual invoice bank details/i)).toBeTruthy();
    await user.type(screen.getByLabelText('Account Number'), 'IN-123456789012');
    await user.type(screen.getByLabelText('Bank Name'), 'HDFC Bank');
    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/paystack/subaccount', {
        merchantId,
        accountNumber: 'IN-123456789012',
        account_name: 'Yodha Shopping',
        bank_name: 'HDFC Bank',
        businessName: 'Yodha Shopping',
      });
    });
  });
});
