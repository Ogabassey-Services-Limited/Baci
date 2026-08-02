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

const bankListResponse = {
  banks: [{ id: 1, name: 'Guaranty Trust Bank', code: '044' }],
};

describe('MerchantBankForm lifecycle feedback', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => bankListResponse,
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

  it('clears the delayed bank suggestion hide timer on unmount', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(
        <MerchantBankForm
          merchantId="22222222-2222-4222-8222-222222222222"
          countryCode="NG"
        />
      );
      fireEvent.blur(
        screen.getByPlaceholderText(
          'Type to search your bank (e.g. GTB, Access)'
        )
      );
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a live region mounted and marks the action busy while verifying bank details', async () => {
    const user = userEvent.setup();
    apiPostMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/paystack/resolve')
        return new Promise(() => undefined);
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });
    render(
      <MerchantBankForm
        merchantId="22222222-2222-4222-8222-222222222222"
        countryCode="NG"
      />
    );

    const accountInput = screen.getByLabelText('Account Number');
    const submitButton = screen.getByRole('button', {
      name: /save bank details/i,
    });
    expect(submitButton).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('');
    const bankInput = screen.getByPlaceholderText(
      'Type to search your bank (e.g. GTB, Access)'
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/paystack/banks')
    );
    await user.type(bankInput, 'Guaranty');
    await user.click(
      await screen.findByRole('option', { name: 'Guaranty Trust Bank' })
    );
    await user.type(accountInput, '1234567890');

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/paystack/resolve', {
        accountNumber: '1234567890',
        bankCode: '044',
      });
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(
        'Verifying bank account details.'
      );
    });
  });

  it('shows a save error and recovers on a subsequent submit', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let subaccountAttempts = 0;
    apiPostMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/api/paystack/resolve') {
        return Promise.resolve({
          account_name: 'Jane Doe',
          account_number: '1234567890',
          bank_id: 1,
        });
      }
      if (endpoint === '/api/paystack/subaccount') {
        subaccountAttempts += 1;
        if (subaccountAttempts === 1)
          return Promise.reject(new Error('Failed to save bank details'));
        return Promise.resolve({
          success: true,
          accountName: 'Jane Doe',
          subaccountCode: 'ACCT_TESTMOCK1234567',
        });
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });
    render(
      <MerchantBankForm
        merchantId="22222222-2222-4222-8222-222222222222"
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
          autoPayoutEnabled: true,
        }}
        onSuccess={onSuccess}
      />
    );

    await screen.findByText('Account Verified');
    await user.click(screen.getByRole('checkbox'));
    const saveButton = screen.getByRole('button', {
      name: /save bank details/i,
    });
    await user.click(saveButton);
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Failed to save bank details',
        })
      );
    });
    expect(onSuccess).not.toHaveBeenCalled();
    const firstSubmitPayload = apiPostMock.mock.calls.findLast(
      ([endpoint]) => endpoint === '/api/paystack/subaccount'
    )?.[1];
    expect(firstSubmitPayload).toMatchObject({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
      autoPayoutEnabled: false,
    });

    await user.click(saveButton);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bank Details Saved',
        description: 'Verified: Jane Doe',
      })
    );
    const subaccountCalls = apiPostMock.mock.calls.filter(
      ([endpoint]) => endpoint === '/api/paystack/subaccount'
    );
    expect(subaccountCalls).toHaveLength(2);
    expect(subaccountCalls[1]?.[1]).toMatchObject({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
      autoPayoutEnabled: false,
    });
  });
});
