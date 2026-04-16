import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  banks: [
    {
      id: 1,
      name: 'Guaranty Trust Bank',
      slug: 'guaranty-trust-bank',
      code: '044',
      longcode: '044150149',
      gateway: null,
      pay_with_bank: false,
      active: true,
      is_deleted: false,
      country: 'Nigeria',
      currency: 'NGN',
      type: 'nuban',
    },
  ],
};

describe('MerchantBankForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
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
          subaccountCode: 'ACCT_test123',
        });
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });
  });

  it('omits auto payout settings when they were not hydrated into the form', async () => {
    const user = userEvent.setup();

    render(
      <MerchantBankForm
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Account Verified')).toBeTruthy();
    });

    expect(screen.queryByText('Automatic Settlements')).toBeNull();
    expect(
      screen.getByText(
        /auto-payout preferences are managed from wallet settings/i
      )
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/api/paystack/subaccount',
        expect.any(Object)
      );
    });

    const submitPayload = apiPostMock.mock.calls.find(
      ([endpoint]) => endpoint === '/api/paystack/subaccount'
    )?.[1];

    expect(submitPayload).toMatchObject({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
    });
    expect(submitPayload).not.toHaveProperty('autoPayoutEnabled');
  });

  it('omits hydrated auto payout settings when the toggle was not changed', async () => {
    const user = userEvent.setup();

    render(
      <MerchantBankForm
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
          autoPayoutEnabled: true,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Account Verified')).toBeTruthy();
    });

    expect(screen.getByText('Automatic Settlements')).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/api/paystack/subaccount',
        expect.any(Object)
      );
    });

    const submitPayload = apiPostMock.mock.calls.find(
      ([endpoint]) => endpoint === '/api/paystack/subaccount'
    )?.[1];

    expect(submitPayload).not.toHaveProperty('autoPayoutEnabled');
  });

  it('submits auto payout settings only when the hydrated toggle was changed', async () => {
    const user = userEvent.setup();

    render(
      <MerchantBankForm
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
          autoPayoutEnabled: true,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Account Verified')).toBeTruthy();
    });

    expect(screen.getByText('Automatic Settlements')).toBeTruthy();
    await user.click(screen.getByRole('checkbox'));
    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/api/paystack/subaccount',
        expect.objectContaining({
          autoPayoutEnabled: false,
        })
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

        if (subaccountAttempts === 1) {
          return Promise.reject(new Error('Failed to save bank details'));
        }

        return Promise.resolve({
          success: true,
          accountName: 'Jane Doe',
          subaccountCode: 'ACCT_test123',
        });
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    render(
      <MerchantBankForm
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
          autoPayoutEnabled: true,
        }}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Account Verified')).toBeTruthy();
    });

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
    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bank Details Saved',
      })
    );

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

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

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
