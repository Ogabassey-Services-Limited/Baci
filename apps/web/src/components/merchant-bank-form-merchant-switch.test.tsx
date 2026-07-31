import { act, render, screen, waitFor } from '@testing-library/react';
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

const merchantAId = '22222222-2222-4222-8222-222222222222';
const merchantBId = '33333333-3333-4333-8333-333333333333';

describe('MerchantBankForm merchant switching', () => {
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
      if (endpoint === '/api/paystack/resolve') {
        return Promise.resolve({
          account_name: 'Jane Doe',
          account_number: '1234567890',
          bank_id: 1,
        });
      }
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

  it('does not submit prior merchant bank details after the merchant changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MerchantBankForm
        merchantId={merchantAId}
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Merchant A',
        }}
      />
    );
    await screen.findByText('Account Verified');

    rerender(
      <MerchantBankForm
        merchantId={merchantBId}
        initialData={{
          accountNumber: '0987654321',
          bankCode: '044',
          businessName: 'Merchant B',
        }}
      />
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Account Number')).toHaveValue('0987654321')
    );
    await screen.findByText('Account Verified');
    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/paystack/subaccount', {
        merchantId: merchantBId,
        accountNumber: '0987654321',
        bankCode: '044',
        businessName: 'Merchant B',
      });
    });
  });

  it('immediately scopes a payout save to the new merchant after a merchant change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MerchantBankForm
        merchantId={merchantAId}
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Merchant A',
        }}
      />
    );

    rerender(
      <MerchantBankForm
        merchantId={merchantBId}
        initialData={{
          accountNumber: '0987654321',
          bankCode: '044',
          businessName: 'Merchant B',
        }}
      />
    );

    expect(screen.getByLabelText('Account Number')).toHaveValue('0987654321');
    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/paystack/subaccount', {
        merchantId: merchantBId,
        accountNumber: '0987654321',
        bankCode: '044',
        businessName: 'Merchant B',
      });
    });
  });

  it('suppresses a prior merchant save completion after the merchant changes', async () => {
    const user = userEvent.setup();
    const onMerchantASuccess = vi.fn();
    let resolveMerchantASave!: () => void;
    apiPostMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/paystack/resolve') {
        return Promise.resolve({
          account_name: 'Jane Doe',
          account_number: '1234567890',
          bank_id: 1,
        });
      }
      if (endpoint === '/api/paystack/subaccount') {
        return new Promise((resolve) => {
          resolveMerchantASave = () =>
            resolve({
              success: true,
              accountName: 'Jane Doe',
              subaccountCode: 'ACCT_TESTMOCK1234567',
            });
        });
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const { rerender } = render(
      <MerchantBankForm
        merchantId={merchantAId}
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Merchant A',
        }}
        onSuccess={onMerchantASuccess}
      />
    );
    await screen.findByText('Account Verified');
    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    rerender(
      <MerchantBankForm
        merchantId={merchantBId}
        countryCode="IN"
        initialData={{
          accountNumber: 'IN-123456789012',
          accountName: 'Merchant B',
          bankName: 'HDFC Bank',
          businessName: 'Merchant B',
        }}
      />
    );

    const saveButton = screen.getByRole('button', {
      name: /save bank details/i,
    });
    expect(saveButton).toBeEnabled();
    expect(saveButton).not.toHaveTextContent('Saving...');
    await act(async () => resolveMerchantASave());

    expect(onMerchantASuccess).not.toHaveBeenCalled();
    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bank Details Saved' })
    );
  });
});
