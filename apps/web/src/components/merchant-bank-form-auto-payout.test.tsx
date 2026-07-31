import { render, screen, waitFor } from '@testing-library/react';
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

describe('MerchantBankForm automatic settlements', () => {
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

  it('omits auto payout settings when they were not hydrated into the form', async () => {
    const user = userEvent.setup();
    render(
      <MerchantBankForm
        merchantId="22222222-2222-4222-8222-222222222222"
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        }}
      />
    );

    await screen.findByText('Account Verified');
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
      merchantId: '22222222-2222-4222-8222-222222222222',
    });
    expect(submitPayload).not.toHaveProperty('autoPayoutEnabled');
  });

  it('omits hydrated auto payout settings when the toggle was not changed', async () => {
    const user = userEvent.setup();
    render(
      <MerchantBankForm
        merchantId="22222222-2222-4222-8222-222222222222"
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
          autoPayoutEnabled: true,
        }}
      />
    );

    await screen.findByText('Account Verified');
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
        merchantId="22222222-2222-4222-8222-222222222222"
        initialData={{
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
          autoPayoutEnabled: true,
        }}
      />
    );

    await screen.findByText('Account Verified');
    await user.click(screen.getByRole('checkbox'));
    await user.click(
      screen.getByRole('button', { name: /save bank details/i })
    );

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/api/paystack/subaccount',
        expect.objectContaining({ autoPayoutEnabled: false })
      );
    });
  });
});
