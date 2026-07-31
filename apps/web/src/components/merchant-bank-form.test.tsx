import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { MerchantBankForm } from './merchant-bank-form';

describe('MerchantBankForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the merchant bank details form with its supplied initial data', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ banks: [] }),
      })
    );

    render(
      <MerchantBankForm
        merchantId="22222222-2222-4222-8222-222222222222"
        countryCode="IN"
        initialData={{
          accountNumber: '1234567890',
          businessName: 'Baci Store',
        }}
      />
    );

    expect(screen.getByLabelText('Account Number')).toHaveValue('1234567890');
    expect(screen.getByLabelText('Bank Name')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save bank details/i })
    ).toBeEnabled();
  });
});
